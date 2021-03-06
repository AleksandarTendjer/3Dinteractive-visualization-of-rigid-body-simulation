let camera, scene, renderer, canvas, light;
// three var
var meshes = [];
var groundMesh;
var groundBody;
//materials
var matBox, matSphere, matBoxSleep, matSphereSleep, matGround, matGroundTrans;
var buffgeoSphere, buffgeoBox;
//for rotation conversion
var ToRad = 0.0174532925199432957;

let world, body;

//user changable properties
let maxNumberOfCubesAndSpheres = 50;
let friction = 0.2;
let restitution = 0.2;
let rotationX = 0;
let rotationY = 0;
let rotationZ = 32;

var antialias = true;
var isMobile = false;

var isDebug=true;
//for variability testing
let frameCount;
let frameArray, timeArray;

init();
animate();

function init() {
  canvas = document.getElementById("canvas");

  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    1,
    10000
  );
  camera.position.set(0, 160, 400);

  controls = new THREE.OrbitControls(camera, canvas);
  controls.target.set(0, 20, 0);
  controls.update();

  scene = new THREE.Scene();

  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    precision: "mediump",
    antialias: antialias
  });
  renderer.setSize(800, 600);

  var materialType = "MeshBasicMaterial";

  if (!isMobile) {
    scene.add(new THREE.AmbientLight(0x3d4143));

    light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(300, 1000, 500);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    var d = 300;
    light.shadow.camera = new THREE.OrthographicCamera(-d, d, d, -d, 500, 1600);
    light.shadow.bias = 0.0001;
    light.shadow.mapSize.width = light.shadow.mapSize.height = 1024;
    scene.add(light);

    materialType = "MeshPhongMaterial";

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; //THREE.BasicShadowMap;
  }

  // background
  var buffgeoBack = new THREE.BufferGeometry();
  buffgeoBack.fromGeometry(new THREE.IcosahedronGeometry(8000, 1));
  var back = new THREE.Mesh(
    buffgeoBack,
    new THREE.MeshBasicMaterial({
      map: gradTexture([
        [1, 0.75, 0.5, 0.25],
        ["#1B1D1E", "#3D4143", "#72797D", "#b0babf"]
      ]),
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  back.geometry.applyMatrix(new THREE.Matrix4().makeRotationZ(15 * ToRad));
  scene.add(back);

  buffgeoSphere = new THREE.BufferGeometry();
  buffgeoSphere.fromGeometry(new THREE.SphereGeometry(1, 20, 10));

  buffgeoBox = new THREE.BufferGeometry();
  buffgeoBox.fromGeometry(new THREE.BoxGeometry(1, 1, 1));

  matSphere = new THREE[materialType]({ map: basicTexture(0), name: "sph" });
  matBox = new THREE[materialType]({ map: basicTexture(2), name: "box" });
  matSphereSleep = new THREE[materialType]({
    map: basicTexture(1),
    name: "ssph"
  });
  matBoxSleep = new THREE[materialType]({ map: basicTexture(3), name: "sbox" });
  matGround = new THREE[materialType]({
    color: 0xff0000,
    transparent: true,
    opacity: 0.5
  });
  matGroundTrans = new THREE[materialType]({
    color: 0x3d4143,
    transparent: true,
    opacity: 0.6
  });

  world = new OIMO.World({
    timestep: 1 / 60, // hitrost simulacije mora biti v skladu s hitrostjo izrisa
    iterations: 8, // več iteracij, bolj natančno
    broadphase: 2, // iskanje trkov: 1 brute force, 2 sweep and prune, 3 volume tree
    worldscale: 100, // skala, privzeta velikost objektov od 0.1 do 10
    random: true, // dodaj naključnost v simulacijo
    info: false, // izpis statistike
    gravity: [0, -9.8, 0] //fizika na Zemlji, za Mars uporabite drugačne konstante
  });

  populate();

  (frameArray = []), (timeArray = []);
}

function animate() {

  if(isDebug){
    if (frameCount < 1000) {
      var t0 = performance.now();
      updateOimoPhysics();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
      var t1 = performance.now();
      frameCount++;
      frameArray.push(frameCount);
      timeArray.push(t1 - t0);
    }else{
    console.log(maxNumberOfCubesAndSpheres)
    console.log(frameArray)
    console.log(timeArray)
    frameCount=0

    var dataPoints = [];

for (var i = 0; i < 1000; i++) {
  dataPoints.push({
    x: frameArray[i],
    y: timeArray[i]
  });
}
const timeAvg = avarage(timeArray);


    var chart = new CanvasJS.Chart("chartContainer", {
      title: {
        text: "Time between frames (From frame 0 - 1000) N= "+maxNumberOfCubesAndSpheres.toString()+"\n AVG="+timeAvg.toString()
      },
      data: [{
        type: "line",
        dataPoints: dataPoints
      }]
    });
    
    chart.render();



    }
  }else{
    updateOimoPhysics();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
 
 

}

function setNumberOfCubesAndSpheres() {
  maxNumberOfCubesAndSpheres = document.getElementById(
    "numberOfCubesAndSpheres"
  ).value;
}

function setFriction() {
  friction = document.getElementById("friction").value;
}

function setRestitution() {
  restitution = document.getElementById("restitution").value;
}

function clearMesh() {
  var i = meshes.length;
  while (i--) scene.remove(meshes[i]);
  meshes = [];

  scene.remove(groundMesh);
}

//----------------------------------
//  OIMO PHYSICS
//----------------------------------

function populate() {
	frameCount = 0;

  // The Bit of a collision group
  var group1 = 1 << 0; // 00000000 00000000 00000000 00000001
  var group2 = 1 << 1; // 00000000 00000000 00000000 00000010
  var group3 = 1 << 2; // 00000000 00000000 00000000 00000100
  var all = 0xffffffff; // 11111111 11111111 11111111 11111111

  type = 3;

  // reset old
  clearMesh();
  world.clear();
  bodies = [];

  // Is all the physics setting for rigidbody
  var config = [
    1, // The density of the shape.
    friction, // The coefficient of friction of the shape.
    restitution, // The coefficient of restitution of the shape.
    1, // The bits of the collision groups to which the shape belongs.
    0xffffffff // The bits of the collision groups with which the shape collides.
  ];

  //add to Oimo
  groundBody = world.add({
    size: [500, 30, 500],
    pos: [130, 40, 0],
    rot: [rotationX, rotationY, rotationZ],
    config: config
  });
  //draw with three
  groundMesh = new THREE.Mesh(buffgeoBox, matGround);
  groundMesh.scale.set(500, 30, 500);
  groundMesh.position.set(130, 40, 0);
  groundMesh.rotation.set(
    rotationX * ToRad,
    rotationY * ToRad,
    rotationZ * ToRad
  );
  scene.add(groundMesh);
  groundMesh.castShadow = true;
  groundMesh.receiveShadow = true;

  /*config[3] = group1;
	config[4] = all & ~group2; // all exepte groupe2
	*/

  // now add object
  var x, y, z, w, h, d;
  var i = maxNumberOfCubesAndSpheres;

  while (i--) {
    if (type === 3) t = Math.floor(Math.random() * 2) + 1;
    else t = type;
    x = 150;
    z = -100 + Math.random() * 200;
    y = 200 + Math.random() * 1000;
    w = 10 + Math.random() * 10;
    h = 10 + Math.random() * 10;
    d = 10 + Math.random() * 10;

    var config = [
      1, // The density of the shape.
      friction, // The coefficient of friction of the shape.
      restitution, // The coefficient of restitution of the shape.
      1, // The bits of the collision groups to which the shape belongs.
      0xffffffff // The bits of the collision groups with which the shape collides.
    ];

    config[4] = all;
    config[1] = friction;
    config[2] = restitution;

    if (t === 1) {
      config[3] = group2;
      bodies[i] = world.add({
        type: "sphere",
        size: [w * 0.5],
        pos: [x, y, z],
        move: true,
        config: config
      });
      meshes[i] = new THREE.Mesh(buffgeoSphere, matSphere);
      meshes[i].scale.set(w * 0.5, w * 0.5, w * 0.5);
    } else if (t === 2) {
      config[3] = group3;
      bodies[i] = world.add({
        type: "box",
        size: [w, h, d],
        pos: [x, y, z],
        move: true,
        config: config
      });
      meshes[i] = new THREE.Mesh(buffgeoBox, matBox);
      meshes[i].scale.set(w, h, d);
    }

    meshes[i].castShadow = true;
    meshes[i].receiveShadow = true;

    scene.add(meshes[i]);
  }
}

function updateOimoPhysics() {
  if (world == null) return;

  world.step();

  var p, r, m, x, y, z;
  var mtx = new THREE.Matrix4();
  var i = bodies.length;
  var mesh;
  var body;

  while (i--) {
    body = bodies[i];
    mesh = meshes[i];

    if (!body.sleeping) {
      mesh.position.copy(body.getPosition());
      mesh.quaternion.copy(body.getQuaternion());

      // change material
      if (mesh.material.name === "sbox") mesh.material = matBox;
      if (mesh.material.name === "ssph") mesh.material = matSphere;

      // reset position
      if (mesh.position.y < -500) {
        x = 150;
        z = -100 + Math.random() * 200;
        y = 100 + Math.random() * 1000;
        body.resetPosition(x, y, z);
      }
    } else {
      if (mesh.material.name === "box") mesh.material = matBoxSleep;
      if (mesh.material.name === "sph") mesh.material = matSphereSleep;
    }
  }

  groundBody.resetRotation(rotationX, rotationY, rotationZ);
  groundMesh.quaternion.copy(groundBody.getQuaternion());
}

function gravity(g) {
  //nG = document.getElementById("gravity").value
  world.gravity = new OIMO.Vec3(0, -9.8, 0);
}

//----------------------------------
//  TEXTURES
//----------------------------------

function gradTexture(color) {
  var c = document.createElement("canvas");
  var ct = c.getContext("2d");
  c.width = 16;
  c.height = 256;
  var gradient = ct.createLinearGradient(0, 0, 0, 256);
  var i = color[0].length;
  while (i--) {
    gradient.addColorStop(color[0][i], color[1][i]);
  }
  ct.fillStyle = gradient;
  ct.fillRect(0, 0, 16, 256);
  var texture = new THREE.Texture(c);
  texture.needsUpdate = true;
  return texture;
}

function basicTexture(n) {
  var canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  var ctx = canvas.getContext("2d");
  var colors = [];
  if (n === 0) {
    // sphere
    colors[0] = "#ffffff";
    colors[1] = "#ffffff";
  }
  if (n === 1) {
    // sphere sleep
    colors[0] = "#ffffff";
    colors[1] = "#ffffff";
  }
  if (n === 2) {
    // box
    colors[0] = "#ffffff";
    colors[1] = "#ffffff";
  }
  if (n === 3) {
    // box sleep
    colors[0] = "#ffffff";
    colors[1] = "#ffffff";
  }
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = colors[1];
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillRect(32, 32, 32, 32);

  var tx = new THREE.Texture(canvas);
  tx.needsUpdate = true;
  return tx;
}

function changeRotation() {
  rotationX = document.getElementById("rotationX").value;
  rotationY = document.getElementById("rotationY").value;
  rotationZ = document.getElementById("rotationZ").value;
}
function avarage(array) {
  var sum = 0;
  var count = array.length;
  for (var i = 0; i < count; i++) {
    sum = sum + array[i];
  }
  return sum / count;
}