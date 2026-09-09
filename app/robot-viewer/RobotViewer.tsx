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
import { movementLean } from "./MotionAttitude";
import { waterSway } from "./WaterSway";
import { ControlKeyboard } from "./ControlKeyboard";
import { thrusterCommand } from "./ThrusterCommand";
import { updateFollowCamera } from "./FollowCamera";
import { createRaceCourse } from "./RaceCourse";
import { createCourseCollision } from "./CourseCollision";
import { createBallInteraction } from "./BallInteraction";
import styles from "./robot-viewer.module.css";

type Telemetry = { position:number[]; speed:number[] };

// The reference-derived assembly lives in DetailedRobot.ts.

function Scene({ onTelemetry, motionMode, onInput, delayEnabled, onBallHint }: { onTelemetry:(value:Telemetry)=>void; motionMode:boolean; onInput:(keys:string[])=>void; delayEnabled:boolean; onBallHint:(hint:string)=>void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const motionRef=useRef(motionMode);
  useEffect(()=>{motionRef.current=motionMode;},[motionMode]);
  const delayRef=useRef(delayEnabled);
  useEffect(()=>{delayRef.current=delayEnabled;},[delayEnabled]);

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
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
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
    // Pool coordinates: near-left bottom corner; X right, Y away, Z up.
    const origin=new THREE.Vector3(-pool.width/2,pool.bottom,pool.length/2);
    for(const [direction,color] of [[new THREE.Vector3(1,0,0),0xf07b70],[new THREE.Vector3(0,0,-1),0x8feb8f],[new THREE.Vector3(0,1,0),0x7eaaff]] as const){
      const arrow=new THREE.ArrowHelper(direction,origin.clone().add(new THREE.Vector3(.05,.05,-.05)),unitsPerMeter*.3,color,.5,.25);
      scene.add(arrow);
    }
    // Conservative clearance includes the complete pod rotation envelope.
    const clearance=Math.hypot(robotSize.x,robotSize.z)/2+.5;
    const limitX=pool.width/2-clearance,limitZ=pool.length/2-clearance;
    const bodyBounds=new THREE.Box3().setFromObject(robot);
    const tiltMargin=clearance*Math.sin(THREE.MathUtils.degToRad(10))+.0045*unitsPerMeter;
    const minY=pool.bottom-bodyBounds.min.y+.3+tiltMargin,maxY=pool.top-bodyBounds.max.y-.3-tiltMargin;
    const movementLimits=new THREE.Box3(new THREE.Vector3(-limitX,minY,-limitZ),new THREE.Vector3(limitX,maxY,limitZ));
    const course=createRaceCourse(unitsPerMeter,pool.bottom);
    scene.add(course.group);
    robot.position.copy(course.start);
    camera.position.add(robot.position);controls.target.copy(robot.position);controls.update();
    key.position.add(robot.position);key.target.position.copy(robot.position);key.target.updateMatrixWorld();rim.position.add(robot.position);
    const pivots:THREE.Object3D[]=[];
    robot.traverse(o=>{if(o.userData.motionPivot)pivots.push(o);});
    scene.add(robot);
    const ballInteraction=createBallInteraction(course.balls,robot,unitsPerMeter,pool.bottom,course.colliders);
    const collision=createCourseCollision(robot,course.colliders,unitsPerMeter,ballInteraction.blocksPose);
    const previousRotation=robot.quaternion.clone(),collisionCorrection=new THREE.Vector3();
    const thrusterEffects=createThrusterEffects(pivots,window.innerWidth<700);
    scene.add(thrusterEffects.points);
    const powers=pivots.map(()=>0),basis=new THREE.Vector3(),podDirection=new THREE.Vector3(),radial=new THREE.Vector3(),frameRotation=new THREE.Quaternion();
    let lastTelemetryTime=-1;
    const previousPosition=robot.position.clone();
    const measuredVelocity=new THREE.Vector3();
    const keys=new Set<string>();
    const rawKeys=new Set<string>();
    const pendingInputs:{at:number;keys:string[]}[]=[];
    const queueInput=(code:string,down:boolean)=>{
      if(rawKeys.has(code)===down)return;
      if(down)rawKeys.add(code);else rawKeys.delete(code);
      onInput([...rawKeys]);
      pendingInputs.push({at:performance.now()+(delayRef.current?1000:0),keys:[...rawKeys]});
    };
    let yawVelocity=0;
    let heading=Math.PI;
    let wasMotion=false;
    let wasDelayed=delayRef.current;
    let followZoom=1,lastFollowDistance=0;
    const displayOffset=camera.position.clone().sub(robot.position),displayTarget=new THREE.Vector3(),followCenter=new THREE.Vector3();
    const follow=()=>{
      followCenter.copy(robot.position);followCenter.y-=previousHeave;
      updateFollowCamera(camera,followCenter,heading,controls.target,followZoom);
      lastFollowDistance=camera.position.distanceTo(controls.target);
    };
    const trackZoom=()=>{
      if(!motionRef.current||!wasMotion||lastFollowDistance===0)return;
      const distance=camera.position.distanceTo(controls.target);
      followZoom=THREE.MathUtils.clamp(followZoom*distance/lastFollowDistance,.45,4);
      lastFollowDistance=distance;
    };
    controls.addEventListener('change',trackZoom);
    const lean=new THREE.Quaternion(),targetLean=new THREE.Quaternion(),yaw=new THREE.Quaternion();
    const swayRotation=new THREE.Quaternion(),swayEuler=new THREE.Euler(0,0,0,'XYZ');
    let swayStrength=0,previousHeave=0;
    const velocity=new THREE.Vector3(),forward=new THREE.Vector3(),right=new THREE.Vector3(),desired=new THREE.Vector3(),displacement=new THREE.Vector3();
    const clearKeys=()=>{keys.clear();if(rawKeys.size){rawKeys.clear();onInput([]);}pendingInputs.length=0;};
    const returnToStart=()=>{
      ballInteraction.reset();
      clearKeys();velocity.set(0,0,0);desired.set(0,0,0);yawVelocity=0;
      heading=Math.PI;swayStrength=0;previousHeave=0;
      lean.identity();targetLean.identity();swayRotation.identity();
      displacement.subVectors(course.start,robot.position);
      robot.position.copy(course.start);robot.rotation.set(0,heading,0);
      previousPosition.copy(robot.position);previousRotation.copy(robot.quaternion);
      measuredVelocity.set(0,0,0);
      pivots.forEach(p=>p.rotation.z=Math.PI);powers.fill(0);
      robot.updateMatrixWorld(true);
      key.position.add(displacement);rim.position.add(displacement);
      key.target.position.copy(robot.position);key.target.updateMatrixWorld();
      if(motionRef.current)follow();
      else {camera.position.add(displacement);controls.target.add(displacement);controls.update();}
      onTelemetry({position:[(robot.position.x+pool.width/2)/unitsPerMeter,(pool.length/2-robot.position.z)/unitsPerMeter,(robot.position.y-pool.bottom)/unitsPerMeter],speed:[0,0,0]});
    };
    const keyboard=(event:KeyboardEvent)=>{
      if(!['KeyL','KeyP','KeyW','KeyA','KeyS','KeyD','KeyJ','KeyK','Space','ShiftLeft','ShiftRight'].includes(event.code))return;
      if(event.type==='keyup'){if(!['KeyP','KeyL'].includes(event.code))queueInput(event.code,false);return;}
      const el=event.target as HTMLElement;
      if(el?.closest('input,textarea,select,[contenteditable="true"]')||event.metaKey||event.ctrlKey||event.altKey)return;
      if(event.repeat)return;
      if(event.code==='KeyP'){event.preventDefault();returnToStart();return;}
      if(event.code==='KeyL'){event.preventDefault();if(motionRef.current)ballInteraction.interact();return;}
      if(motionRef.current){event.preventDefault();queueInput(event.code,true);}
    };
    const touchInput=(event:Event)=>{
      const {code,down}=(event as CustomEvent<{code:string;down:boolean}>).detail;
      if(code==='KeyP'){if(down)returnToStart();return;}
      if(code==='KeyL'){if(down&&motionRef.current)ballInteraction.interact();return;}
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
      if(motionRef.current)return;
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
      previousRotation.copy(robot.quaternion);
      const previousHeading=heading;
      if(wasMotion!==motionRef.current){
        if(motionRef.current){
          displayOffset.subVectors(camera.position,robot.position);
          displayTarget.subVectors(controls.target,robot.position);
          controls.enableDamping=false;controls.update();
          controls.enabled=true;controls.enableRotate=false;controls.enablePan=false;controls.enableZoom=true;
          clearSelection();
        }else{
          camera.position.copy(robot.position).add(displayOffset);
          controls.target.copy(robot.position).add(displayTarget);
          controls.enabled=true;controls.enableRotate=true;controls.enablePan=true;controls.enableDamping=true;controls.update();
        }
        wasMotion=motionRef.current;
      }
      // Remove last frame's visual heave before integrating real displacement.
      // The camera follows travel, not the small wave oscillations.
      robot.position.y-=previousHeave;
      const inputTime=performance.now();
      if(wasDelayed!==delayRef.current){
        pendingInputs.length=0;keys.clear();
        if(delayRef.current)pendingInputs.push({at:inputTime+1000,keys:[...rawKeys]});
        else rawKeys.forEach(code=>keys.add(code));
        wasDelayed=delayRef.current;
      }
      while(pendingInputs.length&&pendingInputs[0].at<=inputTime){
        const input=pendingInputs.shift()!;keys.clear();input.keys.forEach(code=>keys.add(code));
      }
      // User XY plane maps to Three.js XZ; Y remains depth/height.
      if(motionRef.current){
        const turn=Number(keys.has('KeyJ'))-Number(keys.has('KeyK'));
        yawVelocity=THREE.MathUtils.damp(yawVelocity,turn*Math.PI/3,turn?6:9,dt);
        if(Math.abs(yawVelocity)<.0001)yawVelocity=0;
        heading=THREE.MathUtils.euclideanModulo(heading+yawVelocity*dt,Math.PI*2);
        forward.set(Math.sin(heading),0,Math.cos(heading));
        right.crossVectors(forward,THREE.Object3D.DEFAULT_UP).normalize();
        desired.copy(forward).multiplyScalar(Number(keys.has('KeyW'))-Number(keys.has('KeyS')));
        desired.addScaledVector(right,Number(keys.has('KeyD'))-Number(keys.has('KeyA')));
        if(desired.lengthSq()>0)desired.normalize().multiplyScalar(12);
        desired.y=(Number(keys.has('Space'))-Number(keys.has('ShiftLeft')||keys.has('ShiftRight')))*8;
        velocity.lerp(desired,1-Math.exp(-(desired.lengthSq()>0?3.5:1.8)*dt));
        if(velocity.lengthSq()<1e-7)velocity.set(0,0,0);
        displacement.copy(velocity).multiplyScalar(dt);
        const nextX=THREE.MathUtils.clamp(robot.position.x+displacement.x,-limitX,limitX);
        const nextZ=THREE.MathUtils.clamp(robot.position.z+displacement.z,-limitZ,limitZ);
        const nextY=THREE.MathUtils.clamp(robot.position.y+displacement.y,minY,maxY);
        if(nextY<=minY||nextY>=maxY)velocity.y=0;
        if(Math.abs(nextX)>=limitX)velocity.x=0;if(Math.abs(nextZ)>=limitZ)velocity.z=0;
        displacement.set(nextX-robot.position.x,nextY-robot.position.y,nextZ-robot.position.z);
        robot.position.add(displacement);
        key.position.add(displacement);key.target.position.copy(robot.position);key.target.updateMatrixWorld();
        rim.position.add(displacement);
      }else{clearKeys();velocity.set(0,0,0);desired.set(0,0,0);yawVelocity=0;}
      movementLean(velocity,targetLean);
      lean.slerp(targetLean,1-Math.exp(-5*dt));
      yaw.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,heading);
      const swayTarget=motionRef.current?Math.min(1,velocity.length()/4+Math.abs(yawVelocity)*.5):0;
      swayStrength=THREE.MathUtils.damp(swayStrength,swayTarget,2.5,dt);
      if(swayStrength<.0001)swayStrength=0;
      const sway=waterSway(elapsed,swayStrength);
      swayEuler.set(sway.pitch,0,sway.roll);
      swayRotation.setFromEuler(swayEuler);
      robot.quaternion.copy(lean).multiply(yaw).multiply(swayRotation);
      const baseY=robot.position.y;
      robot.position.y=THREE.MathUtils.clamp(baseY+sway.heave*unitsPerMeter,minY,maxY);
      previousHeave=robot.position.y-baseY;
      collisionCorrection.copy(robot.position);
      const fraction=collision.resolve(previousPosition,previousRotation,robot.position,robot.quaternion);
      if(fraction<1){
        const delta=THREE.MathUtils.euclideanModulo(heading-previousHeading+Math.PI,Math.PI*2)-Math.PI;
        heading=previousHeading+delta*fraction;
        collision.rebound(robot.position,robot.quaternion,velocity,movementLimits);
        velocity.set(0,0,0);yawVelocity=0;previousHeave=0;
        collisionCorrection.subVectors(robot.position,collisionCorrection);
        key.position.add(collisionCorrection);rim.position.add(collisionCorrection);
        key.target.position.copy(robot.position);key.target.updateMatrixWorld();
      }
      robot.updateMatrixWorld(true);
      const turnInput=motionRef.current?Number(keys.has('KeyJ'))-Number(keys.has('KeyK')):0;
      const horizontal=Math.hypot(desired.x,desired.z)>1e-5||turnInput!==0;
      pivots.forEach((pivot,index)=>{
        pivot.parent!.getWorldQuaternion(frameRotation);
        basis.set(1,0,0).applyQuaternion(frameRotation);basis.y=0;basis.normalize();
        podDirection.set(desired.x,0,desired.z);
        if(turnInput){
          pivot.getWorldPosition(radial).sub(robot.position);
          podDirection.addScaledVector(new THREE.Vector3(radial.z,0,-radial.x),turnInput*2);
        }
        const command=thrusterCommand(horizontal,Math.sign(desired.y),podDirection.dot(basis),pivot.userData.motionAngle-Math.PI);
        const difference=THREE.MathUtils.euclideanModulo(command.angle-pivot.rotation.z+Math.PI,Math.PI*2)-Math.PI;
        pivot.rotation.z+=Math.sign(difference)*Math.min(Math.abs(difference),step);
        powers[index]=command.power;
      });
      robot.updateMatrixWorld(true);
      thrusterEffects.update(dt,powers);
      ballInteraction.update(dt);
      if(dt>0)measuredVelocity.subVectors(robot.position,previousPosition).divideScalar(dt*unitsPerMeter);
      previousPosition.copy(robot.position);
      if(elapsed-lastTelemetryTime>=.1){
        lastTelemetryTime=elapsed;
        onBallHint(ballInteraction.hint());
        onTelemetry({position:[(robot.position.x+pool.width/2)/unitsPerMeter,(pool.length/2-robot.position.z)/unitsPerMeter,(robot.position.y-pool.bottom)/unitsPerMeter],speed:[measuredVelocity.x,-measuredVelocity.z,measuredVelocity.y]});
      }
      bubbles.position.y = (elapsed * 0.09) % 3;
      if(motionRef.current)follow();else controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const resetView = () => {
      if(motionRef.current){followZoom=1;follow();return;}
      camera.position.copy(robot.position).add(new THREE.Vector3(10.5,7.2,11.5));
      controls.target.copy(robot.position);
      controls.update();
    };
    window.addEventListener("robot-reset-view", resetView);
    const poolView=()=>{if(motionRef.current)return;camera.position.set(pool.width*.65,pool.length*.85,pool.length*.85);controls.target.set(0,0,0);controls.update();};
    window.addEventListener('robot-pool-view',poolView);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown',keyboard);window.removeEventListener('keyup',keyboard);
      window.removeEventListener('blur',clearKeys);document.removeEventListener('visibilitychange',clearKeys);
      window.removeEventListener('robot-move',touchInput);
      observer.disconnect();
      window.removeEventListener("robot-reset-view", resetView);
      window.removeEventListener('robot-pool-view',poolView);
      controls.removeEventListener('change',trackZoom);
      renderer.domElement.removeEventListener("pointerdown", inspectPart);
      renderer.domElement.removeEventListener("contextmenu", preventMenu);
      clearSelection();
      controls.dispose();
      renderer.dispose();
      environment.dispose();
      thrusterEffects.dispose();
      course.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material?.dispose());
        }
      });
      mount.removeChild(renderer.domElement);
    };
  }, [onTelemetry,onInput,onBallHint]);

  return <div ref={mountRef} className={styles.canvas} />;
}

export function RobotViewer() {
  const [pressed,setPressed]=useState<string[]>([]);
  const [motionMode,setMotionMode]=useState(false);
  const [delayEnabled,setDelayEnabled]=useState(true);
  const [ballHint,setBallHint]=useState('前往小球上方，靠近后按 L 吸附');
  const [panelVisible, setPanelVisible] = useState(false);
  const [telemetry,setTelemetry]=useState<Telemetry>({position:[1.5,2.5,.75],speed:[0,0,0]});
  const panelRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if(event.button!==0||(event.target as HTMLElement).closest('button'))return;
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
      <Scene onTelemetry={setTelemetry} motionMode={motionMode} onInput={setPressed} delayEnabled={delayEnabled} onBallHint={setBallHint} />
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.logo}><CornersOut size={22} weight="bold" /></span>
          <div><strong>水下机器人</strong><small>三视图重建 · 装配模型 02</small></div>
        </div>
        <div className={styles.headerActions}>
          <button type="button" aria-pressed={delayEnabled} onClick={()=>setDelayEnabled(v=>!v)}>{delayEnabled?'1 秒延迟：开':'1 秒延迟：关'}</button>
          <button className={styles.modeButton} type="button" disabled={motionMode} title={motionMode?'展示模式可查看全景':'查看水池全景'} onClick={()=>window.dispatchEvent(new Event('robot-pool-view'))}>水池全景</button>
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

      <div className={styles.status}><i /> 水下场景 <span>{motionMode?`跟随视角 · ${delayEnabled?'延迟 1 秒':'无操作延迟'} · Space 上 / Shift 下 · J/K 转向`:'展示模式 · 自由视角'}</span></div>
      {motionMode&&<ControlKeyboard pressed={pressed} delayEnabled={delayEnabled} ballHint={ballHint} />}

      {panelVisible && (
        <section ref={panelRef} className={styles.panel} aria-label="机器人实时位置与速度">
          <div className={styles.panelHandle} onPointerDown={startDrag} onPointerMove={dragPanel}>
            <span><HandGrabbing size={17} /> 位置与速度</span>
            <button type="button" onPointerDown={event=>event.stopPropagation()} onClick={() => setPanelVisible(false)} aria-label="关闭信息面板"><X size={17} /></button>
          </div>
          <div className={styles.panelBody}>
            <table className={styles.telemetryTable}>
              <thead><tr><th>轴</th><th>位置 / m</th><th>速度 / m/s</th></tr></thead>
              <tbody>{['X','Y','Z'].map((axis,i)=><tr key={axis}><th>{axis}</th><td>{telemetry.position[i].toFixed(3)}</td><td>{(Math.abs(telemetry.speed[i])<.0005?0:telemetry.speed[i]).toFixed(3)}</td></tr>)}</tbody>
            </table>
            <p className={styles.telemetryNote}>原点：水池近端左下角池底<br/>X 向右 · Y 沿池长向远端 · Z 向上<br/>显示机体中心位置与实际速度，负值表示反向。</p>
          </div>
        </section>
      )}

      {!motionMode&&<aside className={styles.help} aria-label="操作说明">
        <div><MouseLeftClick size={19} /><span>左键拖动<small>旋转视角</small></span></div>
        <div><MouseMiddleClick size={19} /><span>中键拖动<small>平移画面</small></span></div>
        <div><MouseRightClick size={19} /><span>右键部件<small>查看说明</small></span></div>
        <div className={styles.wheel}><span>⌁</span><span>滚动滚轮<small>缩放视图</small></span></div>
      </aside>}
      {!motionMode&&<p className={styles.touchHint}>单指旋转 · 双指缩放与平移</p>}
    </main>
  );
}
