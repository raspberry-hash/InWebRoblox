import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";

window.addEventListener("DOMContentLoaded", () => {

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, 0);
  camera.up.set(0, 1, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);


  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(20, 40, 10);
  scene.add(dirLight);


  scene.add(new THREE.GridHelper(50, 50));
  scene.add(new THREE.AxesHelper(10));


  const hud = document.getElementById("hud");
  let playerMenu = document.getElementById("playerMenu");
  if (!playerMenu) {
    playerMenu = document.createElement("div");
    playerMenu.id = "playerMenu";
    playerMenu.style.position = "fixed";
    playerMenu.style.top = "35px"; // below HUD
    playerMenu.style.left = "10px";
    playerMenu.style.background = "rgba(100,100,100,0.3)";
    playerMenu.style.padding = "5px";
    playerMenu.style.fontFamily = "monospace";
    playerMenu.style.fontSize = "14px";
    playerMenu.style.color = "white";
    playerMenu.style.maxHeight = "50vh";
    playerMenu.style.overflowY = "auto";
    document.body.appendChild(playerMenu);
  }

  const nametagContainer = document.getElementById("nametags");

  const parts = {};       // THREE meshes
  const nametags = {};    // HTML nametags
  const menuEntries = {}; // Player menu entries


  const moveSpeed = 0.5, turnSpeed = 0.002;
  const keys = { forward:false, back:false, left:false, right:false, up:false, down:false };
  let pitch = 0, yaw = 0;

  renderer.domElement.addEventListener("click", () => renderer.domElement.requestPointerLock());

  window.addEventListener("mousemove", e => {
    if (document.pointerLockElement !== renderer.domElement) return;
    yaw -= e.movementX * turnSpeed;
    pitch -= e.movementY * turnSpeed;
    pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
  });

  window.addEventListener("keydown", e => {
    switch(e.code) {
      case "KeyW": keys.forward = true; break;
      case "KeyS": keys.back = true; break;
      case "KeyA": keys.left = true; break;
      case "KeyD": keys.right = true; break;
      case "Space": keys.up = true; break;
      case "ShiftLeft": keys.down = true; break;
    }
  });
  window.addEventListener("keyup", e => {
    switch(e.code) {
      case "KeyW": keys.forward = false; break;
      case "KeyS": keys.back = false; break;
      case "KeyA": keys.left = false; break;
      case "KeyD": keys.right = false; break;
      case "Space": keys.up = false; break;
      case "ShiftLeft": keys.down = false; break;
    }
  });

  function updateCamera() {
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.rotation.z = 0;

    const dir = new THREE.Vector3();
    if (keys.forward) dir.z -= 1;
    if (keys.back) dir.z += 1;
    if (keys.left) dir.x -= 1;
    if (keys.right) dir.x += 1;
    if (keys.up) dir.y += 1;
    if (keys.down) dir.y -= 1;

    dir.normalize().applyEuler(camera.rotation);
    camera.position.addScaledVector(dir, moveSpeed);
  }


  function makeGeometry(p) {
    switch(p.type){
      case "Ball": return new THREE.SphereGeometry(p.size[0]/2, 32, 32);
      case "Cylinder": return new THREE.CylinderGeometry(p.size[0]/2, p.size[0]/2, p.size[1], 32);
      case "Wedge":
        const wedge = new THREE.ConeGeometry(p.size[0], p.size[1], 4, 1, true);
        wedge.rotateX(-Math.PI/2);
        return wedge;
      case "CornerWedge":
        const geo = new THREE.BufferGeometry();
        const vertices = new Float32Array([
          0,0,0, p.size[0],0,0, 0,p.size[1],0,
          0,0,p.size[2], p.size[0],p.size[1],0, p.size[0],0,p.size[2],
          0,p.size[1],p.size[2], p.size[0],p.size[1],p.size[2]
        ]);
        geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geo.computeVertexNormals();
        return geo;
      case "Block":
      default:
        return new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]);
    }
  }


  function createPart(p) {
    const mesh = new THREE.Mesh(
      makeGeometry(p),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(p.color),
        transparent: p.transparency > 0,
        opacity: 1 - (p.transparency || 0)
      })
    );
    mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);

    const rot = new THREE.Euler(
      THREE.MathUtils.degToRad(p.rotation?.[0] || 0),
      THREE.MathUtils.degToRad(p.rotation?.[1] || 0),
      THREE.MathUtils.degToRad(p.rotation?.[2] || 0)
    );

    mesh.userData = {
      isPlayer: !!p.isPlayer,
      type: p.type || "Block",
      targetPos: mesh.position.clone(),
      targetRot: rot
    };
    scene.add(mesh);
    return mesh;
  }

  function createNametag(id,name) {
    if (!nametagContainer) return null;
    const div = document.createElement("div");
    div.style.position = "absolute";
    div.style.color = "white";
    div.style.fontFamily = "monospace";
    div.style.fontSize = "14px";
    div.style.background = "rgba(0,0,0,0.5)";
    div.style.padding = "2px 4px";
    div.innerText = name;
    nametagContainer.appendChild(div);
    nametags[id] = div;
    return div;
  }

  function updateNametags() {
    for(const id in parts){
      const mesh = parts[id];
      if(!mesh || !mesh.userData.isPlayer) continue;
      let div = nametags[id] || createNametag(id,id);
      if(!div) continue;

      const vector = mesh.position.clone();
      if(mesh.geometry.parameters) vector.y += mesh.geometry.parameters.height/2 + 1;
      else vector.y += 1;
      vector.project(camera);

      const x = (vector.x*0.5+0.5)*window.innerWidth;
      const y = (-vector.y*0.5+0.5)*window.innerHeight;

      div.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
      div.style.display = vector.z < 1 ? "block" : "none";
    }
  }


  function updatePlayerMenu(players) {
    const newIds = players.map(p => p.id);
    Object.keys(menuEntries).forEach(id=>{
      if(!newIds.includes(id)){
        playerMenu.removeChild(menuEntries[id]);
        delete menuEntries[id];
      }
    });

    players.forEach(p=>{
      if(!menuEntries[p.id]){
        const entry = document.createElement("div");
        entry.style.display = "flex";
        entry.style.justifyContent = "space-between";
        entry.style.marginBottom = "2px";
        entry.style.background = "rgba(200,200,200,0.1)";
        entry.style.padding = "2px 4px";
        entry.style.borderRadius = "2px";

        const nameSpan = document.createElement("span");
        nameSpan.textContent = p.id;
        entry.appendChild(nameSpan);

        const btn = document.createElement("button");
        btn.style.background = "#c8c8c81a";
        btn.style.border = "none";
        btn.style.padding = "2px 6px";
        btn.style.cursor = "pointer";
        btn.style.borderRadius = "3px";
        btn.style.color = "white";
        btn.style.fontSize = "12px";
        btn.textContent = "Kick";
        btn.onclick = () => {
          fetch(`/kick/${p.id}`, { method:"POST" });
          console.log(`Kick requested for ${p.id}`);
        };
        entry.appendChild(btn);

        playerMenu.appendChild(entry);
        menuEntries[p.id] = entry;
      }
    });
  }


  async function syncParts(){
    try{
      const res = await fetch("/parts");
      const dataArray = await res.json();
      hud.textContent = dataArray.length===0?"Waiting for Roblox...":`Parts: ${dataArray.length}`;

      const players = dataArray.filter(p=>p.isPlayer);
      updatePlayerMenu(players);

      const newIds = dataArray.map(p=>p.id);
      Object.keys(parts).forEach(id=>{
        if(!newIds.includes(id)){
          scene.remove(parts[id]);
          parts[id].geometry.dispose();
          if(parts[id].material) parts[id].material.dispose();
          delete parts[id];
          if(nametags[id]){
            nametagContainer.removeChild(nametags[id]);
            delete nametags[id];
          }
        }
      });

      dataArray.forEach(p=>{
        let mesh = parts[p.id];
        if(!mesh){
          mesh = createPart(p);
          parts[p.id] = mesh;
          if(p.isPlayer) createNametag(p.id,p.id);
        }

        mesh.userData.targetPos.set(p.pos[0],p.pos[1],p.pos[2]);
        if(p.rotation){
          mesh.userData.targetRot.set(
            THREE.MathUtils.degToRad(p.rotation[0]||0),
            THREE.MathUtils.degToRad(p.rotation[1]||0),
            THREE.MathUtils.degToRad(p.rotation[2]||0)
          );
        }

        const geo = mesh.geometry.parameters;
        if(!geo || mesh.userData.type!==p.type || geo.width!==p.size[0] || geo.height!==p.size[1] || geo.depth!==p.size[2]){
          mesh.geometry.dispose();
          mesh.geometry = makeGeometry(p);
          mesh.userData.type = p.type;
        }

        mesh.material.color = new THREE.Color(p.color);
        mesh.material.opacity = 1 - (p.transparency||0);
        mesh.material.transparent = p.transparency>0;
      });

    }catch(err){
      console.warn("Failed to fetch parts:", err);
    }
  }
  setInterval(syncParts, 100);

  function animate(){
    requestAnimationFrame(animate);
    updateCamera();
    for(const id in parts){
      const mesh = parts[id];
      if(!mesh) continue;
      mesh.position.lerp(mesh.userData.targetPos,0.2);
      mesh.rotation.x += (mesh.userData.targetRot.x - mesh.rotation.x)*0.2;
      mesh.rotation.y += (mesh.userData.targetRot.y - mesh.rotation.y)*0.2;
      mesh.rotation.z += (mesh.userData.targetRot.z - mesh.rotation.z)*0.2;
    }
    renderer.render(scene,camera);
    updateNametags();
  }
  animate();

  window.addEventListener("resize",()=>{
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
  });
});
