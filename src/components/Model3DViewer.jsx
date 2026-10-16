import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { drawDesignFit } from '../lib/designFit'

// Whatever units the file was exported in, the model is scaled so its longest side is this, so the
// camera distances and the shadow below never depend on the file.
const MODEL_SIZE = 0.17
const TEX = 2048

// Camera positions around the model, which is always turned so its printable back faces -Z with
// the phone upright (see normalizeOrientation). Distances are in the normalised units above.
const VIEWS = {
  back: [0, 0.015, -0.38],
  front: [0, 0.015, 0.38],
  left: [-0.38, 0.015, 0],
  right: [0.38, 0.015, 0],
  three: [-0.2, 0.09, -0.3],
  tilt: [0.22, 0.15, -0.28],
}

function makeBackdrop(hex) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const g = c.getContext('2d')
  const base = new THREE.Color(hex)
  const light = base.clone().lerp(new THREE.Color('#ffffff'), 0.28)
  const dark = base.clone().lerp(new THREE.Color('#000000'), 0.35)
  const grad = g.createRadialGradient(256, 215, 20, 256, 256, 380)
  grad.addColorStop(0, `#${light.getHexString()}`)
  grad.addColorStop(0.55, `#${base.getHexString()}`)
  grad.addColorStop(1, `#${dark.getHexString()}`)
  g.fillStyle = grad
  g.fillRect(0, 0, 512, 512)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function makeGradientBackdrop(top, bottom) {
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 512
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 0, 512)
  grad.addColorStop(0, top)
  grad.addColorStop(1, bottom)
  g.fillStyle = grad
  g.fillRect(0, 0, 8, 512)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function makeBlobTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(128, 64, 4, 128, 64, 124)
  grad.addColorStop(0, 'rgba(0,0,0,0.55)')
  grad.addColorStop(0.35, 'rgba(0,0,0,0.28)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.save()
  g.scale(1, 0.5)
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  g.restore()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function makeGrainTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')
  const id = g.createImageData(256, 256)
  for (let i = 0; i < id.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 120
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v
    id.data[i + 3] = 255
  }
  g.putImageData(id, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(60, 60)
  return t
}

const matList = (m) => (Array.isArray(m) ? m : [m])

/// Turns the model so the printable surface's flat back faces -Z and the phone's long side is
/// vertical. Done by measuring the printable triangles' own normals (the sides cancel out, leaving
/// the back's direction), so a model from any source works without matching our axis convention.
function normalizeOrientation(holder, printMeshes) {
  holder.updateMatrixWorld(true)
  const sum = new THREE.Vector3()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (const mesh of printMeshes) {
    const pos = mesh.geometry.attributes.position
    const idx = mesh.geometry.index
    const triCount = idx ? idx.count / 3 : pos.count / 3
    for (let t = 0; t < triCount; t++) {
      const ia = idx ? idx.getX(t * 3) : t * 3
      const ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1
      const ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2
      a.fromBufferAttribute(pos, ia).applyMatrix4(mesh.matrixWorld)
      b.fromBufferAttribute(pos, ib).applyMatrix4(mesh.matrixWorld)
      c.fromBufferAttribute(pos, ic).applyMatrix4(mesh.matrixWorld)
      n.crossVectors(b.sub(a), c.sub(a)) // length = 2 x area, so larger triangles count for more
      sum.add(n)
    }
  }
  if (sum.lengthSq() < 1e-18) return
  holder.quaternion.setFromUnitVectors(sum.normalize(), new THREE.Vector3(0, 0, -1))
  holder.updateMatrixWorld(true)

  // after facing -Z, make the longer side of the printable surface vertical
  const box = new THREE.Box3()
  for (const mesh of printMeshes) box.expandByObject(mesh)
  const size = box.getSize(new THREE.Vector3())
  if (size.x > size.y) {
    holder.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2))
    holder.updateMatrixWorld(true)
  }
}

/// Draws, in the printable rectangle's own coordinates, where the model really has printable surface:
/// `printable` is every printable triangle, `back` only those facing the camera from behind. Whatever
/// the printable rectangle contains that is NOT painted is a hole in the case (camera window, button
/// openings) or empty corner, so the customer can be shown where nothing will print -- read straight
/// from the model, with no extra data from the admin. Must be called after the model has been turned
/// to face -Z (normalizeOrientation) and its matrices updated.
function buildPrintGuide(printMeshes, printMaterialName, layout) {
  const H = 512
  const aspect = (layout.u1 - layout.u0) / (layout.v1 - layout.v0)
  const W = Math.max(1, Math.round(H * aspect))
  const make = () => {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d')
    g.fillStyle = '#fff'
    g.strokeStyle = '#fff'
    g.lineWidth = 1.2 // hides hairline gaps between neighbouring triangles
    g.lineJoin = 'round'
    return { canvas: c, g }
  }
  const printable = make()
  const back = make()

  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const n = new THREE.Vector3()
  const px = (u) => ((u - layout.u0) / (layout.u1 - layout.u0)) * W
  const py = (v) => ((v - layout.v0) / (layout.v1 - layout.v0)) * H

  for (const mesh of printMeshes) {
    const geo = mesh.geometry
    const pos = geo.attributes.position
    const uv = geo.attributes.uv
    if (!uv) continue
    const idx = geo.index
    const total = idx ? idx.count : pos.count
    const mats = matList(mesh.material)
    const ranges = geo.groups.length ? geo.groups : [{ start: 0, count: total, materialIndex: 0 }]
    for (const grp of ranges) {
      if (mats[grp.materialIndex ?? 0]?.name !== printMaterialName) continue
      const end = Math.min(grp.start + grp.count, total)
      for (let t = grp.start; t + 2 < end; t += 3) {
        const i0 = idx ? idx.getX(t) : t
        const i1 = idx ? idx.getX(t + 1) : t + 1
        const i2 = idx ? idx.getX(t + 2) : t + 2
        a.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld)
        b.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld)
        c.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld)
        n.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize()
        const isBack = n.z < -0.7
        for (const target of isBack ? [printable, back] : [printable]) {
          const g = target.g
          g.beginPath()
          g.moveTo(px(uv.getX(i0)), py(uv.getY(i0)))
          g.lineTo(px(uv.getX(i1)), py(uv.getY(i1)))
          g.lineTo(px(uv.getX(i2)), py(uv.getY(i2)))
          g.closePath()
          g.fill()
          g.stroke()
        }
      }
    }
  }
  return { width: W, height: H, printable: printable.canvas, back: back.canvas }
}

/// Frees the GPU memory of a loaded model (geometry, materials and their textures). Without this,
/// switching phones a few times on a phone would steadily eat memory. `keep` lists textures that
/// outlive the model (the shared design texture).
function disposeTree(root, keep = []) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose()
    if (!o.material) return
    for (const m of matList(o.material)) {
      for (const value of Object.values(m)) {
        if (value && value.isTexture && !keep.includes(value)) value.dispose()
      }
      m.dispose()
    }
  })
}

/// Shows a 3D phone-case model and prints a design onto its printable material.
///
/// props:
///   glbUrl            full URL of the .glb
///   printMaterialName name of the material the design is printed onto
///   layout            { u0, u1, v0, v1 } -- where the printable surface's UVs sit in the 0..1 square;
///                     the design is cover-fit into exactly this rectangle
///   designImage       an HTMLImageElement/canvas to print, or null to show the model's own material
///   viewRequest       { name, n } -- change n to re-apply the same named view
///   backdrop          hex colour of the studio backdrop
///   roughness         0.1 (glossy) .. 1 (matte) for the case surface, default 0.6
///   lightStrength     scales every light, default 1
///   autoSpin          slowly turns the phone while true
///   trimColor         hex colour of the unprinted case parts (the material named CASE_PLAIN), if any
///   onLoad / onError  called when the model finishes loading or fails; onLoad receives
///                     { guide, hasTrim } -- see buildPrintGuide -- guide only when a layout was given
///
/// ref.capture(size, { view }) resolves to a square PNG blob (size x size pixels) of the model, rendered
/// at that fixed resolution whatever size the on-screen frame is, so a phone and a desktop produce the
/// same quality of picture. `view` (a name from VIEWS) renders from that angle instead of the current one.
///
/// It draws a new frame only when something changed (the camera moved, a design, background or model
/// changed, or the frame was resized) instead of 60 times a second, which matters for a phone's battery.
const Model3DViewer = forwardRef(function Model3DViewer(
  {
    glbUrl, printMaterialName, layout, designImage, designFit, viewRequest, backdrop = '#c9ccd3',
    roughness = 0.6, lightStrength = 1, autoSpin = false, trimColor = null, onLoad, onError, className = '',
  },
  ref,
) {
  const mountRef = useRef(null)
  const s = useRef({}) // three.js objects, kept out of React state on purpose
  const cb = useRef({})
  cb.current = { onLoad, onError }
  // the model loads asynchronously, so applyDesign must read the newest design, not the one from the
  // render in which loading started
  const latest = useRef({})
  latest.current = { designImage, layout, designFit, roughness, trimColor }

  // ---- one-time scene setup ----
  useEffect(() => {
    const mount = mountRef.current
    // phones and low-core machines get cheaper settings: a lower pixel ratio and a smaller shadow map
    const lowPower = window.matchMedia?.('(pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 8) <= 4
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.VSMShadowMap
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%'
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = makeBackdrop(typeof backdrop === 'string' ? backdrop : '#c9ccd3')
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envTexture
    scene.environmentIntensity = 0.8

    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 5)
    camera.position.set(...VIEWS.back)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.minDistance = 0.12
    controls.maxDistance = 1.5

    const key = new THREE.DirectionalLight(0xfff4e6, 1.5)
    key.position.set(-0.3, 1.0, -0.4)
    key.castShadow = true
    key.shadow.radius = 14
    key.shadow.blurSamples = 24
    key.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048)
    key.shadow.camera.left = -0.3
    key.shadow.camera.right = 0.3
    key.shadow.camera.top = 0.3
    key.shadow.camera.bottom = -0.3
    key.shadow.camera.near = 0.1
    key.shadow.camera.far = 2
    key.shadow.bias = -0.0003
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xdfe8ff, 0.9)
    rim.position.set(0.7, 0.35, -0.2)
    scene.add(rim)

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.ShadowMaterial({ opacity: 0.12 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    const pivot = new THREE.Group()
    scene.add(pivot)

    // a background photo is cover-fitted to the frame (cropped, never stretched), which depends on
    // the frame's shape, so it is recomputed whenever the frame is resized
    const fitBackground = () => {
      const t = scene.background
      if (!t || !t.isTexture || !t.userData.photo || !t.image) return
      const ia = t.image.width / t.image.height
      const ca = (mount.clientWidth || 1) / (mount.clientHeight || 1)
      t.repeat.set(1, 1)
      t.offset.set(0, 0)
      if (ia > ca) {
        t.repeat.x = ca / ia
        t.offset.x = (1 - t.repeat.x) / 2
      } else {
        t.repeat.y = ia / ca
        t.offset.y = (1 - t.repeat.y) / 2
      }
    }
    let needsRender = true
    let frames = 0
    const state = s.current
    const invalidate = () => {
      needsRender = true
    }
    const resize = () => {
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      fitBackground()
      invalidate()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(mount)
    resize()

    controls.addEventListener('change', invalidate)
    renderer.setAnimationLoop(() => {
      if (state.autoSpin) {
        pivot.rotation.y += 0.006
        needsRender = true
      }
      const moving = controls.update() // true while the user drags or the turn is still easing out
      if (!moving && !needsRender) return
      needsRender = false
      renderer.render(scene, camera)
      mount.dataset.frames = String(++frames) // read by tests to prove an idle view draws nothing
    })

    // which look the printable material ended up with ('file' or 'default'), readable by tests and the page
    const mount_setLook = (looks) => {
      mount.dataset.look = looks.print
      // plain facts about the printable material, so tests can check the artist's values were kept
      const pm = s.current.printMaterials?.[0]
      mount.dataset.printRoughness = pm ? String(Math.round(pm.roughness * 100) / 100) : ''
      mount.dataset.printMetalness = pm ? String(Math.round(pm.metalness * 100) / 100) : ''
      mount.dataset.printNormalMap = pm ? String(Boolean(pm.normalMap)) : ''
    }
    Object.assign(s.current, { renderer, scene, camera, controls, floor, pivot, envTexture, pmrem, resize, fitBackground, invalidate, key, rim, mount_setLook })

    return () => {
      ro.disconnect()
      renderer.setAnimationLoop(null)
      disposeTree(pivot, [s.current.designTex])
      s.current.designTex?.dispose()
      controls.dispose()
      renderer.dispose()
      envTexture.dispose()
      pmrem.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
      s.current = {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- load the model whenever the file or the printable material changes ----
  useEffect(() => {
    const st = s.current
    if (!st.scene || !glbUrl) return
    let cancelled = false
    const loader = new GLTFLoader()
    loader.load(
      glbUrl,
      (gltf) => {
        if (cancelled || !s.current.scene) return
        const { pivot, floor, mount_setLook } = s.current
        while (pivot.children.length) {
          const old = pivot.children[0]
          pivot.remove(old)
          disposeTree(old, [s.current.designTex])
        }

        const holder = new THREE.Group()
        holder.add(gltf.scene)

        const printMeshes = []
        gltf.scene.traverse((o) => {
          if (o.isMesh && matList(o.material).some((m) => m.name === printMaterialName)) printMeshes.push(o)
        })
        if (printMeshes.length) normalizeOrientation(holder, printMeshes)

        // scale so the longest side is MODEL_SIZE, centre it, and rest it on the floor
        const box = new THREE.Box3().setFromObject(holder)
        const size = box.getSize(new THREE.Vector3())
        const scale = MODEL_SIZE / Math.max(size.x, size.y, size.z, 1e-9)
        holder.scale.setScalar(scale)
        holder.updateMatrixWorld(true)
        const box2 = new THREE.Box3().setFromObject(holder)
        const center = box2.getCenter(new THREE.Vector3())
        holder.position.sub(center)
        holder.updateMatrixWorld(true)
        const finalSize = box2.getSize(new THREE.Vector3())

        floor.position.y = -finalSize.y / 2 - 0.0005
        const blob = new THREE.Mesh(
          new THREE.PlaneGeometry(0.17, 0.07),
          new THREE.MeshBasicMaterial({ map: makeBlobTexture(), transparent: true, depthWrite: false, toneMapped: false }),
        )
        blob.rotation.x = -Math.PI / 2
        blob.position.y = floor.position.y + 0.0003
        blob.renderOrder = 1

        const printMaterials = []
        const plainMaterials = []
        const looks = { print: 'default', plain: null }
        const grain = makeGrainTexture()
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return
          o.castShadow = true
          o.receiveShadow = true
          o.material = Array.isArray(o.material)
            ? o.material.map((m) => upgradePrint(m, printMaterialName, grain, printMaterials, plainMaterials, looks))
            : upgradePrint(o.material, printMaterialName, grain, printMaterials, plainMaterials, looks)
        })

        pivot.add(holder)
        pivot.add(blob)
        Object.assign(s.current, { printMaterials, plainMaterials })
        pivot.rotation.y = 0
        applyDesign()
        applyLook()
        s.current.invalidate()
        const guide = layout && printMeshes.length ? buildPrintGuide(printMeshes, printMaterialName, layout) : null
        mount_setLook(looks)
        s.current.invalidate()
        cb.current.onLoad?.({ printMeshCount: printMeshes.length, guide, hasTrim: plainMaterials.length > 0, look: looks.print })
      },
      undefined,
      (err) => cb.current.onError?.(err),
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glbUrl, printMaterialName])

  // ---- surface look: roughness of the case, colour of the plain trim ----
  function applyLook() {
    const st = s.current
    const { roughness: rough, trimColor: trim } = latest.current
    for (const m of [...(st.printMaterials || []), ...(st.plainMaterials || [])]) {
      if (!m.userData.ownLook) m.roughness = rough
    }
    if (trim) for (const m of st.plainMaterials || []) m.color.set(trim)
    st.invalidate?.()
  }
  useEffect(applyLook, [roughness, trimColor])

  useEffect(() => {
    const st = s.current
    if (!st.key) return
    st.key.intensity = 1.5 * lightStrength
    st.rim.intensity = 0.9 * lightStrength
    st.scene.environmentIntensity = 0.8 * lightStrength
    st.invalidate()
  }, [lightStrength])

  useEffect(() => {
    s.current.autoSpin = autoSpin
    s.current.invalidate?.()
  }, [autoSpin])

  // ---- print the design (or show the model's own material when there is none) ----
  function applyDesign() {
    const st = s.current
    const { designImage, layout, designFit } = latest.current
    if (!st.printMaterials) return
    if (!designImage || !layout) {
      for (const m of st.printMaterials) {
        m.map = m.userData.originalMap || null
        if (m.userData.ownLook) m.color.copy(m.userData.originalColor)
        m.needsUpdate = true
      }
      st.invalidate?.()
      return
    }
    if (!st.designCanvas) {
      st.designCanvas = document.createElement('canvas')
      st.designCanvas.width = TEX
      st.designCanvas.height = TEX
      st.designTex = new THREE.CanvasTexture(st.designCanvas)
      st.designTex.colorSpace = THREE.SRGBColorSpace
      st.designTex.flipY = false
      st.designTex.anisotropy = st.renderer.capabilities.getMaxAnisotropy()
    }
    const ctx = st.designCanvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, TEX, TEX)
    // the same function the placement guide uses, so what the customer drags is what gets printed
    drawDesignFit(
      ctx,
      designImage,
      { x: layout.u0 * TEX, y: layout.v0 * TEX, w: (layout.u1 - layout.u0) * TEX, h: (layout.v1 - layout.v0) * TEX },
      designFit,
    )
    st.designTex.needsUpdate = true
    for (const m of st.printMaterials) {
      m.map = st.designTex
      // the artist's colour tint would tint the customer's design, so it is whitened while a design is on
      if (m.userData.ownLook) m.color.set('#ffffff')
      m.needsUpdate = true
    }
    st.invalidate?.()
  }
  useEffect(applyDesign, [designImage, layout, designFit?.zoom, designFit?.panX, designFit?.panY])

  // ---- camera presets ----
  useEffect(() => {
    const st = s.current
    if (!st.camera || !viewRequest) return
    const p = VIEWS[viewRequest.name]
    if (!p) return
    st.camera.position.set(...p)
    st.controls.target.set(0, 0, 0)
    st.controls.update()
    st.invalidate()
  }, [viewRequest])

  // ---- backdrop: colour string, { top, bottom } gradient, or { imageUrl } photo ----
  const backdropKey = typeof backdrop === 'string' ? backdrop : JSON.stringify(backdrop)
  useEffect(() => {
    const st = s.current
    if (!st.scene) return
    let cancelled = false
    const set = (tex) => {
      st.scene.background?.dispose?.()
      st.scene.background = tex
      st.invalidate()
    }
    if (typeof backdrop === 'string') {
      set(makeBackdrop(backdrop))
    } else if (backdrop?.top && backdrop?.bottom) {
      set(makeGradientBackdrop(backdrop.top, backdrop.bottom))
    } else if (backdrop?.imageUrl) {
      const loader = new THREE.TextureLoader()
      loader.setCrossOrigin('anonymous') // so the exported PNG is not blocked as "tainted"
      loader.load(
        backdrop.imageUrl,
        (tex) => {
          if (cancelled || !s.current.scene) {
            tex.dispose()
            return
          }
          tex.colorSpace = THREE.SRGBColorSpace
          tex.userData.photo = true
          set(tex)
          s.current.fitBackground()
        },
        undefined,
        () => cb.current.onError?.(new Error('background')),
      )
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backdropKey])

  useImperativeHandle(ref, () => ({
    capture: (size = 2048, { view, design } = {}) =>
      new Promise((resolve) => {
        const { renderer, scene, camera, controls, resize, fitBackground } = s.current
        // `design` shows a different picture on the case for this one shot only (the list thumbnail)
        const previousLatest = latest.current
        if (design) {
          latest.current = { ...previousLatest, designImage: design, designFit: { zoom: 1, panX: 0, panY: 0 } }
          applyDesign()
        }
        const prevRatio = renderer.getPixelRatio()
        const prevPos = camera.position.clone()
        const prevTarget = controls.target.clone()
        if (view && VIEWS[view]) {
          camera.position.set(...VIEWS[view])
          controls.target.set(0, 0, 0)
          // the controls only turn the camera on their next update, and this renders straight away
          camera.lookAt(controls.target)
        }
        renderer.setPixelRatio(1)
        renderer.setSize(size, size, false)
        camera.aspect = 1
        camera.updateProjectionMatrix()
        fitBackground()
        renderer.render(scene, camera)
        renderer.domElement.toBlob((blob) => {
          camera.position.copy(prevPos)
          controls.target.copy(prevTarget)
          camera.lookAt(prevTarget)
          renderer.setPixelRatio(prevRatio)
          if (design) {
            latest.current = previousLatest
            applyDesign()
          }
          resize()
          resolve(blob)
        }, 'image/png')
      }),
  }))

  return <div ref={mountRef} className={className} />
})

/// Does this material carry a look the model's artist deliberately made -- leather grain, a glossy
/// finish, metal, a soft sheen -- as opposed to a plain colour with nothing else set? Used to decide
/// whether to keep the file's material or fall back to our built-in soft silicone look.
///
/// Anything an artist has to go out of their way to make counts: any surface texture (normal, bump,
/// roughness, metal or occlusion map), the extra shaders (clearcoat, sheen, transmission), metal, or an
/// explicitly glossy roughness. A matte plain colour does not, because that is what a file with no
/// material work in it looks like.
function hasOwnLook(m) {
  const physical = m.isMeshPhysicalMaterial
  return Boolean(
    m.normalMap || m.bumpMap || m.roughnessMap || m.metalnessMap || m.aoMap ||
      (physical && (m.clearcoat > 0 || m.sheen > 0 || m.transmission > 0 || m.iridescence > 0)) ||
      m.metalness > 0.2 ||
      m.roughness < 0.45,
  )
}

/// Prepares the materials of a loaded model for printing:
///  - the printable material keeps the artist's finish when the file has one (hasOwnLook): only its
///    colour picture is swapped for the customer's design, and its colour tint is whitened while a
///    design is on so the design is not tinted; otherwise it gets our soft silicone look;
///  - the unprinted trim (material CASE_PLAIN) is treated the same way;
///  - every other material is left exactly as the file made it.
/// `looks` records which way each went, so the page can tell the admin and hide controls that would
/// override a deliberate finish.
function upgradePrint(m, printName, grain, printMaterials, plainMaterials, looks) {
  const isPrint = m.name === printName
  const isPlain = m.name === 'CASE_PLAIN' && !isPrint
  if (!isPrint && !isPlain) return m

  const own = hasOwnLook(m)
  if (own) {
    // keep the artist's material; for the printable one remember how to take the design back off
    if (isPrint) {
      m.userData.ownLook = true
      m.userData.originalMap = m.map
      m.userData.originalColor = m.color.clone()
      printMaterials.push(m)
      looks.print = 'file'
    } else {
      looks.plain = 'file'
    }
    return m
  }

  const soft = new THREE.MeshPhysicalMaterial({
    name: m.name,
    map: isPrint ? m.map : null,
    color: m.color,
    roughness: 0.6,
    metalness: 0,
    sheen: 0.18,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color('#d8dce6'),
    bumpMap: grain,
    bumpScale: 0.12,
  })
  if (isPrint) {
    soft.userData.originalMap = m.map
    printMaterials.push(soft)
    looks.print = 'default'
  } else {
    plainMaterials.push(soft)
    looks.plain = 'default'
  }
  return soft
}

export default Model3DViewer
