import * as T from 'three';

// Metres in pool coordinates: X right, Y towards far end, Z above the floor.
export const COURSE={start:[.58,.75],gates:[[.58,1.45],[.94,2.75],[.58,3.95]],ball:[.58,4.55]} as const;
// Clear opening dimensions, not the outside dimensions of the frame (metres).
export const GATE_SPECS=[
  {width:.82,bottom:.80,height:.47,angle:0},
  {width:.82,bottom:.10,height:.53,angle:0},
  {width:.56,bottom:.39,height:.56,angle:Math.PI/6},
] as const;

export function createRaceCourse(units:number,bottom:number) {
  const group=new T.Group();group.name='取球赛道';
  const textures:T.Texture[]=[];
  const colliders:T.Mesh<T.BoxGeometry>[]=[];
  const orange=new T.MeshStandardMaterial({color:0xffb23e,roughness:.36,metalness:.2});
  const navy=new T.MeshStandardMaterial({color:0x12364b,roughness:.48,metalness:.35});
  const steel=new T.MeshStandardMaterial({color:0xabb9bf,metalness:.72,roughness:.28});
  const white=new T.MeshStandardMaterial({color:0xe8ffff,roughness:.5});
  const point=(x:number,y:number,z:number)=>new T.Vector3((x-1.5)*units,bottom+z*units,(2.5-y)*units);
  const box=(size:number[],position:number[],material:T.Material,parent:T.Object3D=group)=>{
    const o=new T.Mesh(new T.BoxGeometry(size[0]*units,size[1]*units,size[2]*units),material);
    o.position.set(position[0]*units,position[1]*units,position[2]*units);o.castShadow=true;o.receiveShadow=true;parent.add(o);colliders.push(o);return o;
  };
  function label(text:string,width:number,height:number) {
    if(typeof document==='undefined')return new T.MeshBasicMaterial({color:0xffffff});
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=Math.round(512*height/width);
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#12364b';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle='#ffbf50';ctx.lineWidth=12;ctx.strokeRect(6,6,canvas.width-12,canvas.height-12);
    ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${canvas.height*.6}px system-ui, sans-serif`;
    ctx.fillText(text,canvas.width/2,canvas.height/2);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;textures.push(texture);
    return new T.MeshBasicMaterial({map:texture,side:T.DoubleSide});
  }
  for(const [index,[x,y]] of COURSE.gates.entries()) {
    const gate=new T.Group();gate.name=`赛道门 ${index+1}`;gate.position.copy(point(x,y,0));group.add(gate);
    const spec=GATE_SPECS[index],half=spec.width/2+.03,top=spec.bottom+spec.height;
    gate.rotation.y=spec.angle;
    gate.userData={openingWidthM:spec.width,openingHeightM:spec.height};
    // Two weighted feet, square-section posts and an unobstructed opening.
    for(const side of [-1,1]){
      box([.14,.075,.30],[side*half,.0375,0],navy,gate);
      box([.06,top-.015,.08],[side*half,(top+.135)/2,0],orange,gate);
      box([.075,.04,.09],[side*half,spec.bottom+.08,0],white,gate);
      box([.075,.04,.09],[side*half,top-.08,0],white,gate);
      for(const dz of [-.12,.12]){
        const bolt=new T.Mesh(new T.CylinderGeometry(.015*units,.015*units,.015*units,6),steel);
        bolt.position.set(side*half*units,.083*units,dz*units);gate.add(bolt);
      }
    }
    box([spec.width+.12,.06,.08],[0,spec.bottom-.03,0],orange,gate);
    box([spec.width+.12,.06,.08],[0,top+.03,0],orange,gate);
    // Number mounted on the beam: no tall sign above the opening.
    box([.18,.12,.045],[0,top+.04,0],navy,gate);
    const sign=new T.Mesh(new T.PlaneGeometry(.17*units,.11*units),label(String(index+1),.17,.11));
    sign.position.set(0,(top+.04)*units,.041*units);gate.add(sign);
    // Duplicate printed face so the number reads correctly from either direction.
    const back=sign.clone();back.position.z=-.041*units;back.rotation.y=Math.PI;gate.add(back);
  }
  const waypoints=[COURSE.start,...COURSE.gates,COURSE.ball].map(([x,y])=>point(x,y,.018));
  const path=new T.CatmullRomCurve3(waypoints,false,'centripetal');
  const line=new T.Mesh(new T.TubeGeometry(path,160,.013*units,6,false),orange);group.add(line);
  for(let i=1;i<14;i++){
    const t=i/14,p=path.getPointAt(t),d=path.getTangentAt(t);
    const arrow=new T.ArrowHelper(d,p,.11*units,0xffdf7e,.06*units,.045*units);group.add(arrow);
  }
  function floorLabel(text:string,x:number,y:number,w:number,h:number){
    const sign=new T.Mesh(new T.PlaneGeometry(w*units,h*units),label(text,w,h));
    sign.rotation.x=-Math.PI/2;sign.position.copy(point(x,y,.025));group.add(sign);
  }
  floorLabel('START',COURSE.start[0],COURSE.start[1]-.2,.5,.19);
  floorLabel('BALL',COURSE.ball[0],COURSE.ball[1]+.23,.4,.16);
  const stand=new T.Mesh(new T.CylinderGeometry(.16*units,.19*units,.06*units,40),navy);
  stand.position.copy(point(...COURSE.ball,.03));group.add(stand);
  const ball=new T.Mesh(new T.SphereGeometry(.09*units,32,24),new T.MeshStandardMaterial({color:0xffdf3d,roughness:.22,metalness:.06}));
  ball.name='目标球';ball.position.copy(point(...COURSE.ball,.15));ball.castShadow=true;group.add(ball);
  const band=new T.Mesh(new T.TorusGeometry(.091*units,.007*units,8,40),white);
  band.rotation.x=Math.PI/2;band.position.copy(ball.position);group.add(band);
  group.updateMatrixWorld(true);
  return {group,colliders,start:point(...COURSE.start,.75),dispose:()=>textures.forEach(t=>t.dispose())};
}
