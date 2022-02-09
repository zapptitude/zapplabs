import './style.css'
import * as THREE from 'three'

const maxTime = 1000
var camera, scene, renderer

var whole, time

init()
animate()

function init() {

    time = 0
    camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 100 )
    camera.position.z = 50

    scene = new THREE.Scene()
    whole = new THREE.Group()
    const size = 10
    var geometry = new THREE.BoxGeometry( size, size, size )
    var material = new THREE.MeshNormalMaterial()

    // volume
    var volume = new THREE.Mesh( geometry, material )
    whole.add( volume )
    scene.add( whole )

    // wrapper
    var wrapper = new THREE.Group()
    whole.add( wrapper )
    function add_side( x, y, z ) {
        const shrink = 0.98
        const geometry = new THREE.PlaneGeometry( size * shrink, size * shrink )
        const material = new THREE.MeshBasicMaterial( {color: 0xffff00, side: THREE.DoubleSide} )
        var side = new THREE.Mesh( geometry, material )
        side.position.set( x, y, z )
        wrapper.add( side )
        const material1 = new THREE.MeshBasicMaterial( {color: 0xff8800, side: THREE.DoubleSide} )
        var side1 = new THREE.Mesh( geometry, material1 )
        side1.position.set( x, y, z + 0.1 )
        wrapper.add( side1 )
    }
    const gap = 1 * size
    add_side( 0, 0, -gap )
    add_side( -size, 0, -gap )
    add_side( size, 0, -gap )
    add_side( 2 * size, 0, -gap )
    add_side( 0, size, -gap )
    add_side( 0, -size, -gap )

    renderer = new THREE.WebGLRenderer( { antialias: true } )
    renderer.setSize( window.innerWidth, window.innerHeight )
    document.body.appendChild( renderer.domElement )
}

function animate() {

    time += 1
    if ( time >= maxTime ) {
        time = 0
    }
    requestAnimationFrame( animate )

    const rotationX = whole.rotation.x
    const rotationY = whole.rotation.y
    whole.rotation.x = 0
    whole.rotation.y = 0
    whole.rotation.x = rotationX + 0.01
    whole.rotation.y = rotationY + 0.005

    renderer.render( scene, camera )

}
