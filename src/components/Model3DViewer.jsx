import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

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
///   onLoad / onError  called when the model finishes loading or fails
///
/// ref.capture(size) resolves to a square PNG blob (size x size pixels) of the current view, rendered
/// at that fixed resolution whatever size the on-screen frame is, so a phone and a desktop produce the
/// same quality of picture.
const Model3DViewer = forwardRef(function Model3DViewer(
  { glbUrl, printMaterialName, layout, designImage, designFit, viewRequest, backdrop = '#c9ccd3', onLoad, onError, className = '' },
  ref,
) {
  const mountRef = useRef(null)
  const s = useRef({}) // three.js objects, kept out of React state on purpose
  const cb = useRef({})
  cb.current = { onLoad, onError }
  // the model loads asynchronously, so applyDesign must read the newest design, not the one from the
  // render in which loading started
  const latest = useRef({})
  latest.current = { designImage, layout, designFit }

  // ---- one-time scene setup ----
  useEffect(() => {
    const mount = mountRef.current
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
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
    key.shadow.mapSize.set(2048, 2048)
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
    const resize = () => {
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      fitBackground()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(mount)
    resize()

    renderer.setAnimationLoop(() => {
      controls.update()
      renderer.render(scene, camera)
    })

    Object.assign(s.current, { renderer, scene, camera, controls, floor, pivot, envTexture, pmrem, resize, fitBackground })

    return () => {
      ro.disconnect()
      renderer.setAnimationLoop(null)
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
        const { pivot, floor } = s.current
        while (pivot.children.length) pivot.remove(pivot.children[0])

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
        const grain = makeGrainTexture()
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return
          o.castShadow = true
          o.receiveShadow = true
          o.material = Array.isArray(o.material)
            ? o.material.map((m) => upgradePrint(m, printMaterialName, grain, printMaterials))
            : upgradePrint(o.material, printMaterialName, grain, printMaterials)
        })

        pivot.add(holder)
        pivot.add(blob)
        Object.assign(s.current, { printMaterials })
        applyDesign()
        cb.current.onLoad?.({ printMeshCount: printMeshes.length })
      },
      undefined,
      (err) => cb.current.onError?.(err),
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glbUrl, printMaterialName])

  // ---- print the design (or show the model's own material when there is none) ----
  function applyDesign() {
    const st = s.current
    const { designImage, layout, designFit } = latest.current
    if (!st.printMaterials) return
    if (!designImage || !layout) {
      for (const m of st.printMaterials) {
        m.map = m.userData.originalMap || null
        m.needsUpdate = true
      }
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
    const rx = layout.u0 * TEX
    const ry = layout.v0 * TEX
    const rw = (layout.u1 - layout.u0) * TEX
    const rh = (layout.v1 - layout.v0) * TEX
    const iw = designImage.naturalWidth || designImage.width
    const ih = designImage.naturalHeight || designImage.height
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, TEX, TEX)
    // cover-fit the design into the printable rectangle, then apply the customer's zoom and move
    // (panX/panY run -1..1 across however much of the design is hidden past the edge)
    const zoom = designFit?.zoom ?? 1
    const k = Math.max(rw / iw, rh / ih) * zoom
    const dw = iw * k
    const dh = ih * k
    const maxX = Math.max(0, (dw - rw) / 2)
    const maxY = Math.max(0, (dh - rh) / 2)
    const dx = rx + (rw - dw) / 2 - (designFit?.panX ?? 0) * maxX
    const dy = ry + (rh - dh) / 2 - (designFit?.panY ?? 0) * maxY
    ctx.save()
    ctx.beginPath()
    ctx.rect(rx, ry, rw, rh)
    ctx.clip()
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(designImage, dx, dy, dw, dh)
    ctx.restore()
    st.designTex.needsUpdate = true
    for (const m of st.printMaterials) {
      m.map = st.designTex
      m.needsUpdate = true
    }
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
    capture: (size = 2048) =>
      new Promise((resolve) => {
        const { renderer, scene, camera, resize, fitBackground } = s.current
        const prevRatio = renderer.getPixelRatio()
        renderer.setPixelRatio(1)
        renderer.setSize(size, size, false)
        camera.aspect = 1
        camera.updateProjectionMatrix()
        fitBackground()
        renderer.render(scene, camera)
        renderer.domElement.toBlob((blob) => {
          renderer.setPixelRatio(prevRatio)
          resize()
          resolve(blob)
        }, 'image/png')
      }),
  }))

  return <div ref={mountRef} className={className} />
})

/// Replaces the printable material with a softly-matte physical one (keeping the model's own map so
/// it can be restored); leaves every other material exactly as the file made it.
function upgradePrint(m, printName, grain, printMaterials) {
  if (m.name !== printName) return m
  const pm = new THREE.MeshPhysicalMaterial({
    name: m.name,
    map: m.map,
    color: m.color,
    roughness: 0.6,
    metalness: 0,
    sheen: 0.18,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color('#d8dce6'),
    bumpMap: grain,
    bumpScale: 0.12,
  })
  pm.userData.originalMap = m.map
  printMaterials.push(pm)
  return pm
}

export default Model3DViewer
