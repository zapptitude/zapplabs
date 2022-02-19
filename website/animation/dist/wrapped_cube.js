// import * as THREE from 'three'
import * as THREE from 'https://unpkg.com/three@0.137.5/build/three.js'

const canvas = document.querySelector('canvas.webgl')
const maxTime = 360
const size = 10
const showingOrigin = false
const xInit = -1
const yInit = 0
const zInit = -1

var camera, scene, renderer

var whole, wrapper, globalTime, time

class CubePosition extends THREE.Vector3 {
  static p000 = new CubePosition(0, 0, 0)
  static p001 = new CubePosition(0, 0, 1)
  static p010 = new CubePosition(0, 1, 0)
  static p100 = new CubePosition(1, 0, 0)
}
/* Used for the discrete cubePositioninate system. */

class Direction extends THREE.Vector3 {
  /* A direction is a vector in {-1, 0, 1}^3 such that |x| + |y| + |z| = 1. */
  static posX = new Direction(1, 0, 0)
  static negX = new Direction(-1, 0, 0)
  static posY = new Direction(0, 1, 0)
  static negY = new Direction(0, -1, 0)
  static posZ = new Direction(0, 0, 1)
  static negZ = new Direction(0, 0, -1)
  constructor(x, y, z) {
    if (Math.abs(x) + Math.abs(y) + Math.abs(z) != 1 || x * y != 0 || x * z != 0 || y * z != 0)
      throw new Error('Invalid direction.')
    super(x, y, z)
  }

  rotateHalfPi(direction) {
    if (direction.x) {
      if (this.y) {
        this.z = direction.x * this.y
        this.y = 0
      } else if (this.z) {
        this.y = -direction.x * this.z
        this.z = 0
      }
    } else if (direction.y) {
      if (this.x) {
        this.z = -direction.y * this.x
        this.x = 0
      } else if (this.z) {
        this.x = direction.y * this.z
        this.z = 0
      }
    } else if (direction.z) {
      if (this.x) {
        this.y = direction.z * this.x
        this.x = 0
      } else if (this.y) {
        this.x = -direction.z * this.y
        this.y = 0
      }
    }
  }
}

class CubeWrapperSide extends THREE.Group {
  /*
  One piece of wrapper that covers a single face of the cube.
  */

  static thickness = 0.01
  static size = size * 0.99

  constructor(
    cubePosition = new CubePosition(0, 0, 0),
    normal = new Direction(0, 0, -1)) {
    super()
    const geometry = new THREE.PlaneGeometry(CubeWrapperSide.size, CubeWrapperSide.size)
    const materialI = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      side: THREE.DoubleSide
    })
    var inner = new THREE.Mesh(geometry, materialI)
    const materialO = new THREE.MeshBasicMaterial({
      color: 0xffffaa,
      side: THREE.DoubleSide
    })
    var outer = new THREE.Mesh(geometry, materialO)
    inner.position.z += CubeWrapperSide.thickness / 2
    outer.position.z -= CubeWrapperSide.thickness / 2
    this.add(inner)
    this.add(outer)
    this.normal = normal
    this.setOrientation(normal)
    this.cubePosition = cubePosition
    this.setPosition(cubePosition)
  }

  #getRefPosition(cubePosition = this.cubePosition) {
    /* Returns what this.position should be based on cubePosition. */
    if (this.normal.x)
      return {
        x: cubePosition.x * size,
        y: (cubePosition.y + 0.5) * size,
        z: (cubePosition.z + 0.5) * size
      }
    if (this.normal.y)
      return {
        x: (cubePosition.x + 0.5) * size,
        y: cubePosition.y * size,
        z: (cubePosition.z + 0.5) * size
      }
    if (this.normal.z)
      return {
        x: (cubePosition.x + 0.5) * size,
        y: (cubePosition.y + 0.5) * size,
        z: cubePosition.z * size
      }
  }

  #getCubePosition() {
    /* Returns cubePosition based on the this.position. */
    if (this.normal.x)
      return {
        x: Math.round(this.position.x / size),
        y: Math.round(this.position.y / size - 0.5),
        z: Math.round(this.position.z / size - 0.5)
      }
    if (this.normal.y)
      return {
        x: Math.round(this.position.x / size - 0.5),
        y: Math.round(this.position.y / size),
        z: Math.round(this.position.z / size - 0.5)
      }
    if (this.normal.z)
      return {
        x: Math.round(this.position.x / size - 0.5),
        y: Math.round(this.position.y / size - 0.5),
        z: Math.round(this.position.z / size)
      }
  }

  setOrientation(normal = null) {
    if (normal)
      this.normal.copy(normal)
    const pi_2 = Math.PI / 2
    this.rotation.set(this.normal.x * pi_2, this.normal.y * pi_2, this.normal.z * pi_2)
  }

  setPosition(cubePosition = null) {
    if (cubePosition)
      this.cubePosition.copy(cubePosition)
    this.position.copy(this.#getRefPosition())
  }

  translate(cubePosition, rate = 1.0) {
    if (rate < 0 || rate > 1)
      throw new Error('Rate must be in [0, 1]')
    const p = new THREE.Vector3().copy(this.#getRefPosition())
    const new_p = new THREE.Vector3().copy(this.#getRefPosition(cubePosition))
    this.position.addVectors(p.multiplyScalar(1 - rate), new_p.multiplyScalar(rate))
    if (rate >= 1) {
      this.cubePosition.copy(cubePosition)
    }
  }

  #rotate(c, a, p) {
    /* Returns the new point p after a rotation of p of angle a around center c. */
    return [
      c[0] + (p[0] - c[0]) * Math.cos(a) - (p[1] - c[1]) * Math.sin(a),
      c[1] + (p[1] - c[1]) * Math.cos(a) + (p[0] - c[0]) * Math.sin(a)
    ]
  }

  rotate(axis, direction, positive, rate = 1.0) {
    if (rate < 0 || rate > 1)
      throw new Error('Rate must be in [0, 1]')
    const center = new THREE.Vector3().copy(axis).multiplyScalar(size)
    const p = this.#getRefPosition()
    var d0, d1, d2
    if (direction.x) {
      d0 = 'x'
      d1 = 'y'
      d2 = 'z'
    } else if (direction.y) {
      d0 = 'y'
      d1 = 'x'
      d2 = 'z'
    } else if (direction.z) {
      d0 = 'z'
      d1 = 'x'
      d2 = 'y'
    }
    const thetaClose = 2 * positive - 1
    const theta = direction[d0] * Math.PI / 2 * rate
    const newP = this.#rotate([center[d1], center[d2]], thetaClose * theta, [p[d1], p[d2]])
    this.rotation[d0] = theta + thetaClose * this.normal[d1] * Math.PI / 2
    this.position[d1] = newP[0]
    this.position[d2] = newP[1]
    if (rate >= 1) {
      this.normal.rotateHalfPi(direction)
      this.cubePosition.copy(this.#getCubePosition())
      this.position.copy(this.#getRefPosition())
    }
  }
}


function init() {

  time = 0
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.z = 60

  scene = new THREE.Scene()
  whole = new THREE.Group()
  scene.add(whole)

  // volume
  const shrink = 0.99
  var geometry = new THREE.BoxGeometry(size * shrink, size * shrink, size * shrink)
  var material = new THREE.MeshNormalMaterial()
  var volume = new THREE.Mesh(geometry, material)
  volume.position.set(size / 2, size / 2, size / 2)
  whole.add(volume)
  if (showingOrigin)
    whole.add(new THREE.Mesh(new THREE.BoxGeometry(.3, .3, .3), material))

  // wrapper
  wrapper = new THREE.Group()
  for (var i = 0; i < 6; i++)
    wrapper.add(new CubeWrapperSide())
  whole.add(wrapper)

  renderer = new THREE.WebGLRenderer({
    antialias: true
  })
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)

  // whole.rotation.x = -1.2
  // whole.rotation.z = -1.9
  // whole.rotation.y =0
}


function animate() {

  requestAnimationFrame(animate)

  const start = 10
  const move = 10
  const pause = 3
  const end = 20
  const animTime = start * 2 + move * 12 + pause * 10 * end

  function beginMove(i) {
    return start + i * (move + pause)
  }

  function endMove(i) {
    return beginMove(i) + move
  }

  function rateInMove(i) {
    return (time - beginMove(i)) / move
  }

  function totalTime() {
    return 0
  }

  const rotationX = whole.rotation.x
  const rotationY = whole.rotation.y
  whole.rotation.x = 0
  whole.rotation.y = 0

  function animateCube1() {

    const sidesXY = [
      [0, 0],
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [0, -2]
    ]
    if (time == 0) {
      for (var i = 0; i < wrapper.children.length; i++)
        wrapper.children[i].setPosition({
          x: sidesXY[i][0] + xInit,
          y: sidesXY[i][1] + yInit,
          z: zInit
        })
    } else if (beginMove(0) < time && time <= endMove(0)) {
      for (var i = 0; i < wrapper.children.length; i++)
        wrapper.children[i].translate({
          x: sidesXY[i][0],
          y: sidesXY[i][1],
          z: 0
        }, rateInMove(0))
    } else if (beginMove(1) < time && time <= endMove(1)) {
      wrapper.children[1].rotate(CubePosition.p100, Direction.negY, false, rateInMove(1))
    } else if (beginMove(2) < time && time <= endMove(2)) {
      wrapper.children[2].rotate(CubePosition.p010, Direction.posX, true, rateInMove(2))
    } else if (beginMove(3) < time && time <= endMove(3)) {
      wrapper.children[3].rotate(CubePosition.p000, Direction.posY, false, rateInMove(3))
    } else if (beginMove(4) < time && time <= endMove(4)) {
      wrapper.children[4].rotate(CubePosition.p000, Direction.negX, true, rateInMove(4))
      wrapper.children[5].rotate(CubePosition.p000, Direction.negX, true, rateInMove(4))
    } else if (beginMove(5) < time && time <= endMove(5)) {
      wrapper.children[5].rotate(CubePosition.p001, Direction.negX, true, rateInMove(5))
    } else if (beginMove(6) < time && time <= endMove(6)) {
      wrapper.children[5].rotate(CubePosition.p001, Direction.posX, true, rateInMove(6))
    } else if (beginMove(7) < time && time <= endMove(7)) {
      wrapper.children[4].rotate(CubePosition.p000, Direction.posX, true, rateInMove(7))
      wrapper.children[5].rotate(CubePosition.p000, Direction.posX, true, rateInMove(7))
    } else if (beginMove(8) < time && time <= endMove(8)) {
      wrapper.children[3].rotate(CubePosition.p000, Direction.negY, false, rateInMove(8))
    } else if (beginMove(9) < time && time <= endMove(9)) {
      wrapper.children[2].rotate(CubePosition.p010, Direction.negX, true, rateInMove(9))
    } else if (beginMove(10) < time && time <= endMove(10)) {
      wrapper.children[1].rotate(CubePosition.p100, Direction.posY, false, rateInMove(10))
    } else if (beginMove(11) < time && time <= endMove(11)) {
      for (var i = 0; i < wrapper.children.length; i++)
        wrapper.children[i].translate({
            x: sidesXY[i][0] + xInit,
            y: sidesXY[i][1] + yInit,
            z: zInit
          },
          rateInMove(11))
    }
  }

  animateCube1()

  whole.rotation.x = rotationX + 0.02
  whole.rotation.y = rotationY + 0.01

  renderer.render(scene, camera)
  globalTime = (globalTime + 1) % maxTime
  time = (time + 1) % maxTime
}

init()
animate()
