"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowsClockwise,
  CornersOut,
  Eye,
  EyeSlash,
  HandGrabbing,
  MouseLeftClick,
  MouseMiddleClick,
  MouseRightClick,
  X,
} from "@phosphor-icons/react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createDetailedRobot } from "./DetailedRobot";
import { createThrusterEffects } from "./ThrusterEffects";
import { createPool } from "./Pool";
import styles from "./robot-viewer.module.css";

type SelectedPart = { name: string; note: string };

// The reference-derived assembly lives in DetailedRobot.ts.

function Scene({ onSelect, motionMode }: { onSelect: (part: SelectedPart) => void; motionMode:boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const motionRef=useRef(motionMode);
  useEffect(()=>{motionRef.current=motionMode;},[motionMode]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x031b29);
    scene.fog = new THREE.FogExp2(0x24708a, 0.005);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
    camera.position.set(10.5, 7.2, 11.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    scene.environmentIntensity = 1.15;
    room.dispose();
    pmrem.dispose();
    renderer.domElement.setAttribute("aria-label", "水下机器人三维视图");
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.target.set(0, 0, 0);
    controls.minDistance = 7;
    controls.maxDistance = 160;
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI - 0.15;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    controls.mouseButtons.RIGHT = undefined as unknown as THREE.MOUSE;
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

    scene.add(new THREE.HemisphereLight(0xe4f2ff, 0x293643, 1.2));
    const key = new THREE.DirectionalLight(0xfffaf2, 3.2);
    key.position.set(-6, 10, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    scene.add(key);
    const rim = new THREE.PointLight(0x16b8cf, 24, 20, 2);
    rim.position.set(7, 2, -6);
    scene.add(rim);

    const robot = createDetailedRobot();
    robot.rotation.y = Math.PI;
    const robotSize=new THREE.Box3().setFromObject(robot).getSize(new THREE.Vector3());
    const unitsPerMeter=robotSize.z/.4;
    const pool=createPool(unitsPerMeter);
    scene.add(pool.group);
    // Conservative clearance includes the complete pod rotation envelope.
    const clearance=Math.hypot(robotSize.x,robotSize.z)/2+.5;
    const limitX=pool.width/2-clearance,limitZ=pool.length/2-clearance;
    const bodyBounds=new THREE.Box3().setFromObject(robot);
    const minY=pool.bottom-bodyBounds.min.y+.3,maxY=pool.top-bodyBounds.max.y-.3;
    const pivots:THREE.Object3D[]=[];
    robot.traverse(o=>{if(o.userData.motionPivot)pivots.push(o);});
    scene.add(robot);
    const thrusterEffects=createThrusterEffects(pivots,window.innerWidth<700);
    scene.add(thrusterEffects.points);
    const keys=new Set<string>();
    const rawKeys=new Set<string>();
    const pendingInputs:{at:number;keys:string[]}[]=[];
    const queueInput=(code:string,down:boolean)=>{
      if(rawKeys.has(code)===down)return;
      if(down)rawKeys.add(code);else rawKeys.delete(code);
      pendingInputs.push({at:performance.now()+1000,keys:[...rawKeys]});
    };
    let yawVelocity=0;
    const velocity=new THREE.Vector3(),forward=new THREE.Vector3(),right=new THREE.Vector3(),desired=new THREE.Vector3(),displacement=new THREE.Vector3();
    const clearKeys=()=>{keys.clear();rawKeys.clear();pendingInputs.length=0;};
    const keyboard=(event:KeyboardEvent)=>{
      if(!['KeyW','KeyA','KeyS','KeyD','KeyJ','KeyK','ShiftLeft','ShiftRight','ControlLeft','ControlRight'].includes(event.code))return;
      if(event.type==='keyup'){queueInput(event.code,false);return;}
      const el=event.target as HTMLElement;
      if(el?.closest('input,textarea,select,[contenteditable="true"]')||event.metaKey||event.altKey)return;
      if(motionRef.current){event.preventDefault();queueInput(event.code,true);}
    };
    const touchInput=(event:Event)=>{
      const {code,down}=(event as CustomEvent<{code:string;down:boolean}>).detail;
      if(down&&motionRef.current)queueInput(code,true);else queueInput(code,false);
    };
    window.addEventListener('keydown',keyboard);window.addEventListener('keyup',keyboard);
    window.addEventListener('blur',clearKeys);document.addEventListener('visibilitychange',clearKeys);
    window.addEventListener('robot-move',touchInput);


    const bubbleCount = window.innerWidth < 700 ? 110 : 220;
    const bubblePositions = new Float32Array(bubbleCount * 3);
    for (let i = 0; i < bubbleCount; i += 1) {
      bubblePositions[i * 3] = (Math.random() - 0.5) * pool.width;
      bubblePositions[i * 3 + 1] = Math.random() * (pool.depth-3) + pool.bottom;
      bubblePositions[i * 3 + 2] = (Math.random() - 0.5) * pool.length;
    }
    const bubbleGeometry = new THREE.BufferGeometry();
    bubbleGeometry.setAttribute("position", new THREE.BufferAttribute(bubblePositions, 3));
    const bubbles = new THREE.Points(
      bubbleGeometry,
      new THREE.PointsMaterial({ color: 0x8eddeb, size: 0.055, transparent: true, opacity: 0.6, depthWrite: false }),
    );
    scene.add(bubbles);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const selectedMaterials = new Map<THREE.Mesh, THREE.Material>();
    const clearSelection = () => {
      selectedMaterials.forEach((material, mesh) => { (mesh.material as THREE.Material).dispose(); mesh.material = material; });
      selectedMaterials.clear();
    };
    const inspectPart = (event: PointerEvent) => {
      if (event.button !== 2) return;
      event.preventDefault();
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(robot, true).find((item) => item.object.userData.partName);
      clearSelection();
      if (hit?.object instanceof THREE.Mesh) {
        selectedMaterials.set(hit.object, hit.object.material as THREE.Material);
        hit.object.material = new THREE.MeshStandardMaterial({ color: 0x46e5db, emissive: 0x0b625f, emissiveIntensity: 0.5 });
        onSelect({ name: hit.object.userData.partName, note: hit.object.userData.partNote });
      }
    };
    const preventMenu = (event: MouseEvent) => event.preventDefault();
    renderer.domElement.addEventListener("pointerdown", inspectPart);
    renderer.domElement.addEventListener("contextmenu", preventMenu);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      const mobile = window.innerWidth < 700;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.75));
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let frame = 0;
    const clock = new THREE.Clock();
    let previousTime=0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const dt=Math.min(elapsed-previousTime,.05);
      const step=dt*Math.PI/1.5;
      previousTime=elapsed;
      const inputTime=performance.now();
      while(pendingInputs.length&&pendingInputs[0].at<=inputTime){
        const input=pendingInputs.shift()!;keys.clear();input.keys.forEach(code=>keys.add(code));
      }
      // User XY plane maps to Three.js XZ; Y remains depth/height.
      if(motionRef.current){
        forward.subVectors(controls.target,camera.position);forward.y=0;
        if(forward.lengthSq()<1e-6)forward.set(0,0,-1);else forward.normalize();
        right.crossVectors(forward,THREE.Object3D.DEFAULT_UP).normalize();
        desired.copy(forward).multiplyScalar(Number(keys.has('KeyW'))-Number(keys.has('KeyS')));
        desired.addScaledVector(right,Number(keys.has('KeyD'))-Number(keys.has('KeyA')));
        if(desired.lengthSq()>0)desired.normalize().multiplyScalar(12);
        desired.y=(Number(keys.has('ShiftLeft')||keys.has('ShiftRight'))-Number(keys.has('ControlLeft')||keys.has('ControlRight')))*8;
        const turn=Number(keys.has('KeyJ'))-Number(keys.has('KeyK'));
        yawVelocity=THREE.MathUtils.damp(yawVelocity,turn*Math.PI/3,turn?6:9,dt);
        if(Math.abs(yawVelocity)<.0001)yawVelocity=0;
        robot.rotation.y=THREE.MathUtils.euclideanModulo(robot.rotation.y+yawVelocity*dt,Math.PI*2);
        velocity.lerp(desired,1-Math.exp(-(desired.lengthSq()>0?3.5:1.8)*dt));
        if(velocity.lengthSq()<1e-7)velocity.set(0,0,0);
        displacement.copy(velocity).multiplyScalar(dt);
        const nextX=THREE.MathUtils.clamp(robot.position.x+displacement.x,-limitX,limitX);
        const nextZ=THREE.MathUtils.clamp(robot.position.z+displacement.z,-limitZ,limitZ);
        const nextY=THREE.MathUtils.clamp(robot.position.y+displacement.y,minY,maxY);
        if(nextY<=minY||nextY>=maxY)velocity.y=0;
        if(Math.abs(nextX)>=limitX)velocity.x=0;if(Math.abs(nextZ)>=limitZ)velocity.z=0;
        displacement.set(nextX-robot.position.x,nextY-robot.position.y,nextZ-robot.position.z);
        robot.position.add(displacement);camera.position.add(displacement);controls.target.add(displacement);
        key.position.add(displacement);key.target.position.copy(robot.position);key.target.updateMatrixWorld();
        rim.position.add(displacement);
      }else{clearKeys();velocity.set(0,0,0);yawVelocity=0;}
      for(const pivot of pivots){
        const target=motionRef.current?pivot.userData.motionAngle:pivot.userData.restAngle;
        const difference=target-pivot.rotation.z;
        pivot.rotation.z+=Math.sign(difference)*Math.min(Math.abs(difference),step);
      }
      robot.updateMatrixWorld(true);
      thrusterEffects.update(dt,motionRef.current);
      bubbles.position.y = (elapsed * 0.09) % 3;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const resetView = () => {
      camera.position.copy(robot.position).add(new THREE.Vector3(10.5,7.2,11.5));
      controls.target.copy(robot.position);
      controls.update();
    };
    window.addEventListener("robot-reset-view", resetView);
    const poolView=()=>{camera.position.set(pool.width*.65,pool.length*.85,pool.length*.85);controls.target.set(0,0,0);controls.update();};
    window.addEventListener('robot-pool-view',poolView);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown',keyboard);window.removeEventListener('keyup',keyboard);
      window.removeEventListener('blur',clearKeys);document.removeEventListener('visibilitychange',clearKeys);
      window.removeEventListener('robot-move',touchInput);
      observer.disconnect();
      window.removeEventListener("robot-reset-view", resetView);
      window.removeEventListener('robot-pool-view',poolView);
      renderer.domElement.removeEventListener("pointerdown", inspectPart);
      renderer.domElement.removeEventListener("contextmenu", preventMenu);
      clearSelection();
      controls.dispose();
      renderer.dispose();
      environment.dispose();
      thrusterEffects.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material?.dispose());
        }
      });
      mount.removeChild(renderer.domElement);
    };
  }, [onSelect]);

  return <div ref={mountRef} className={styles.canvas} />;
}

export function RobotViewer() {
  const [motionMode,setMotionMode]=useState(false);
  const [panelVisible, setPanelVisible] = useState(true);
  const [selected, setSelected] = useState<SelectedPart>({
    name: "整机姿态",
    note: "初稿依据正视、俯视及旋转 180° 后的左视参考图建立。",
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (window.innerWidth < 700 || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragOffset.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const dragPanel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !panelRef.current) return;
    const width = panelRef.current.offsetWidth;
    const height = panelRef.current.offsetHeight;
    panelRef.current.style.left = `${Math.max(12, Math.min(window.innerWidth - width - 12, event.clientX - dragOffset.current.x))}px`;
    panelRef.current.style.top = `${Math.max(76, Math.min(window.innerHeight - height - 12, event.clientY - dragOffset.current.y))}px`;
    panelRef.current.style.right = "auto";
  };

  return (
    <main className={styles.viewer}>
      <Scene onSelect={setSelected} motionMode={motionMode} />
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.logo}><CornersOut size={22} weight="bold" /></span>
          <div><strong>水下机器人</strong><small>三视图重建 · 装配模型 02</small></div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.modeButton} type="button" onClick={()=>window.dispatchEvent(new Event('robot-pool-view'))}>水池全景</button>
          <button className={styles.modeButton} type="button" aria-pressed={motionMode} onClick={()=>setMotionMode(v=>!v)}>
            {motionMode?'运动模式':'展示模式'}
          </button>
          <button type="button" onClick={() => window.dispatchEvent(new Event("robot-reset-view"))}>
            <ArrowsClockwise size={18} /><span>复位视角</span>
          </button>
          <button type="button" onClick={() => setPanelVisible((visible) => !visible)} aria-pressed={panelVisible}>
            {panelVisible ? <EyeSlash size={18} /> : <Eye size={18} />}<span>{panelVisible ? "隐藏面板" : "显示面板"}</span>
          </button>
        </div>
      </header>

      <div className={styles.status}><i /> 水下场景 <span>{motionMode?'延迟 1 秒 · WASD 平移 · Shift 上 / Ctrl 下 · J 左转 / K 右转':'展示模式 · 初始姿态'}</span></div>
      {motionMode&&<div className={styles.swimPad} aria-label="平面移动方向键">
        {[['ShiftLeft','上浮'],['ControlLeft','下潜'],['KeyJ','左转'],['KeyK','右转']].map(([code,label])=><button key={code} type="button" aria-label={label}
          onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);window.dispatchEvent(new CustomEvent('robot-move',{detail:{code,down:true}}));}}
          onPointerUp={()=>window.dispatchEvent(new CustomEvent('robot-move',{detail:{code,down:false}}))}
          onLostPointerCapture={()=>window.dispatchEvent(new CustomEvent('robot-move',{detail:{code,down:false}}))}
          onPointerCancel={()=>window.dispatchEvent(new CustomEvent('robot-move',{detail:{code,down:false}}))}>{label}</button>)}
        {['W','A','S','D'].map(letter=><button key={letter} type="button" aria-label={{W:'向前',A:'向左',S:'向后',D:'向右'}[letter]}
          onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);window.dispatchEvent(new CustomEvent('robot-move',{detail:{code:`Key${letter}`,down:true}}));}}
          onPointerUp={()=>window.dispatchEvent(new CustomEvent('robot-move',{detail:{code:`Key${letter}`,down:false}}))}
          onLostPointerCapture={()=>window.dispatchEvent(new CustomEvent('robot-move',{detail:{code:`Key${letter}`,down:false}}))}
          onPointerCancel={()=>window.dispatchEvent(new CustomEvent('robot-move',{detail:{code:`Key${letter}`,down:false}}))}>{letter}</button>)}
      </div>}

      {panelVisible && (
        <section ref={panelRef} className={styles.panel} aria-label="模型信息面板">
          <div className={styles.panelHandle} onPointerDown={startDrag} onPointerMove={dragPanel}>
            <span><HandGrabbing size={17} /> 模型信息</span>
            <button type="button" onClick={() => setPanelVisible(false)} aria-label="关闭信息面板"><X size={17} /></button>
          </div>
          <div className={styles.panelBody}>
            <p className={styles.label}>当前部件</p>
            <h1>{selected.name}</h1>
            <p className={styles.note}>{selected.note}</p>
            <div className={styles.separator} />
            <p className={styles.label}>建模基准</p>
            <dl className={styles.specs}>
              <div><dt>推进器</dt><dd>四角布置</dd></div>
              <div><dt>水池内尺寸</dt><dd>3 × 5 m</dd></div>
              <div><dt>机器人长度</dt><dd>40 cm</dd></div>
              <div><dt>池深（暂定）</dt><dd>1.5 m</dd></div>
              <div><dt>池底砖缝</dt><dd>每格 10 cm</dd></div>
              <div><dt>舵机轴线</dt><dd>XY 平面 45°</dd></div>
              <div><dt>推进器姿态</dt><dd>{motionMode?'斜向前方':'初始姿态'}</dd></div>
              <div><dt>视图校正</dt><dd>左视图旋转 180°</dd></div>
            </dl>
          </div>
        </section>
      )}

      <aside className={styles.help} aria-label="操作说明">
        <div><MouseLeftClick size={19} /><span>左键拖动<small>旋转视角</small></span></div>
        <div><MouseMiddleClick size={19} /><span>中键拖动<small>平移画面</small></span></div>
        <div><MouseRightClick size={19} /><span>右键部件<small>查看说明</small></span></div>
        <div className={styles.wheel}><span>⌁</span><span>滚动滚轮<small>缩放视图</small></span></div>
      </aside>
      <p className={styles.touchHint}>单指旋转 · 双指缩放与平移</p>
    </main>
  );
}
