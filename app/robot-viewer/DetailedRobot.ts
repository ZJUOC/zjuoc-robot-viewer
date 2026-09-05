import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Image reconstruction coordinates: X transverse, Y up, Z cylinder axis.
// Dimensions are relative, not engineering measurements.
export function createDetailedRobot() {
  const root = new T.Group();
  const movingThrusters: { frame:T.Group; thruster:T.Group }[]=[];
  const silver = new T.MeshStandardMaterial({ color: 0xc6c7c9, metalness: .82, roughness: .3 });
  const edge = new T.MeshStandardMaterial({ color: 0x777d87, metalness: .85, roughness: .25 });
  const plate = new T.MeshStandardMaterial({ color: 0x656575, metalness: .65, roughness: .36 });
  const black = new T.MeshStandardMaterial({ color: 0x171b22, metalness: .28, roughness: .39 });
  const carbon = new T.MeshStandardMaterial({ color: 0x25282c, metalness: .12, roughness: .48 });
  const green = new T.MeshStandardMaterial({ color: 0x087b62, metalness: .2, roughness: .42 });
  const gold = new T.MeshStandardMaterial({ color: 0xb79448, metalness: .75, roughness: .27 });
  const glass = new T.MeshPhysicalMaterial({color: 0xd8dcf2, metalness: 0, roughness: .12, transparent:true, opacity:.24, depthWrite:false, side:T.DoubleSide});
  let part = '保护框架';
  function mesh(g:T.BufferGeometry,m:T.Material,p=[0,0,0],parent:T.Object3D=root) {
    const o=new T.Mesh(g,m); o.position.set(p[0],p[1],p[2]);
    o.userData.partName=part; o.userData.partNote='依据三视图重建的装配结构，尺寸为图像比例估算。'; parent.add(o); return o;
  }
  function box(w:number,h:number,d:number,p:number[],m:T.Material=silver,parent:T.Object3D=root) {return mesh(new T.BoxGeometry(w,h,d),m,p,parent);}
  function cyl(r:number,h:number,p:number[],m:T.Material=silver,axis='y',parent:T.Object3D=root,r2=r) {
    const o=mesh(new T.CylinderGeometry(r,r2,h,40),m,p,parent);
    if(axis==='z')o.rotation.x=Math.PI/2;if(axis==='x')o.rotation.z=Math.PI/2;return o;
  }
  function ring(r:number,t:number,p:number[],m:T.Material=silver,axis='z',parent:T.Object3D=root) {
    const o=mesh(new T.TorusGeometry(r,t,8,64),m,p,parent);if(axis==='y')o.rotation.x=Math.PI/2;if(axis==='x')o.rotation.y=Math.PI/2;return o;
  }
  function rod(a:number[],b:number[],r:number,m:T.Material=silver,parent:T.Object3D=root) {
    const av=new T.Vector3(...a),bv=new T.Vector3(...b),delta=bv.clone().sub(av);
    const o=cyl(r,delta.length(),av.add(bv).multiplyScalar(.5).toArray(),m,'y',parent);
    o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;
  }
  function bolt(p:number[],axis='z',parent:T.Object3D=root,size=.035) {
    cyl(size*1.6,.014,p,edge,axis,parent);
    const o=mesh(new T.CylinderGeometry(size,size,.033,6),silver,p,parent);
    if(axis==='z')o.rotation.x=Math.PI/2;if(axis==='x')o.rotation.z=Math.PI/2;
    const q=[...p];q[axis==='z'?2:axis==='x'?0:1]+=.019;
    cyl(size*.48,.005,q,black,axis,parent);
  }
  function cutPlate(points:number[][],holes:number[][],depth:number,p:number[],m:T.Material=silver,flat=false,parent:T.Object3D=root) {
    const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();
    for(const [x,y,r] of holes){const h=new T.Path();h.absarc(x,y,r,0,Math.PI*2,true);s.holes.push(h);}
    const o=mesh(new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.008,bevelThickness:.008,curveSegments:32}),m,p,parent);
    if(flat)o.rotation.x=-Math.PI/2;return o;
  }
  // Transparent cylindrical pressure vessel, stacked flanges and two end plates.
  part='透明耐压舱';
  const hull=mesh(new T.CylinderGeometry(1.65,1.65,5.8,96,1,true),glass);hull.rotation.x=Math.PI/2;
  for(const sign of [-1,1]) {
    part=sign===1?'前端设备板':'后端设备板';
    for(let i=0;i<5;i++)cyl(1.7+(i%2)*.035,.055,[0,0,sign*(2.78+i*.073)],i%2?black:silver,'z');
    cyl(1.65,.09,[0,0,sign*3.12],plate,'z');
    for(let i=0;i<12;i++){const a=i*Math.PI/6;bolt([1.59*Math.sin(a),1.59*Math.cos(a),sign*3.18]);}
    // Three large and eight small circular interfaces, as in the front view.
    const ports=[[-.43,.25,.285],[.43,.25,.285],[0,-.51,.285],
      [0,1.13,.16],[-.8,.8,.16],[.8,.8,.16],[-1.13,0,.16],[1.13,0,.16],[-.8,-.8,.16],[.8,-.8,.16],[0,-1.13,.16]];
    ports.forEach(([x,y,r])=>{
      cyl(r*1.12,.032,[x,y,sign*3.19],black,'z');
      cyl(r,.18,[x,y,sign*3.27],silver,'z');
      ring(r*.95,.013,[x,y,sign*3.365],edge);
      cyl(r*.89,.012,[x,y,sign*3.37],silver,'z');
    });
  }
  // End hoops are cut sheet profiles with four conspicuous loop openings.
  part='开孔保护框架';
  for(const z of [-2.65,2.65]) {
    ring(1.76,.045,[0,0,z]);
    for(const sx of [-1,1])for(const sy of [-1,1]) {
      const s=new T.Shape();
      s.moveTo(.27,1.55);s.bezierCurveTo(.65,1.89,.75,2.24,1.03,2.24);
      s.bezierCurveTo(1.41,2.29,1.51,1.9,1.63,1.35);s.lineTo(1.89,.22);s.lineTo(1.74,.1);s.lineTo(1.47,1.13);s.closePath();
      const h=new T.Path();h.moveTo(.57,1.65);h.bezierCurveTo(.87,2.17,1.18,2.41,1.37,1.69);h.lineTo(1.19,1.34);h.closePath();s.holes.push(h);
      const o=mesh(new T.ExtrudeGeometry(s,{depth:.075,bevelEnabled:true,bevelSize:.009,bevelThickness:.009,bevelSegments:1}),silver,[0,0,z]);o.scale.set(sx,sy,1);
    }
    cutPlate([[-.55,-1.53],[.55,-1.53],[.36,-2.29],[0,-2.46],[-.36,-2.29]],[[0,-2.1,.27]],.09,[0,0,z]);
    ring(.29,.045,[0,-2.1,z+.09]);
    for(const sx of [-1,1]){box(.27,.56,.15,[sx*1.76,0,z]);for(const y of [-.19,.19])bolt([sx*1.76,y,z+.09]);}
  }
  // Triangular side saddles and lower bearing apertures from the corrected side view.
  for(const sx of [-1,1]) {
    const s=new T.Shape();s.moveTo(-1.18,-.03);s.lineTo(-.23,1.66);s.lineTo(.23,1.66);s.lineTo(1.18,-.03);s.lineTo(.5,-.18);s.lineTo(.32,-.59);s.lineTo(-.32,-.59);s.lineTo(-.5,-.18);s.closePath();
    for(const side of [-1,1]) {
      const h=new T.Path();h.moveTo(side*.22,1.3);h.lineTo(side*.82,.08);h.lineTo(side*.37,.08);h.closePath();s.holes.push(h);
    }
    const bearing=new T.Path();bearing.absarc(0,-.2,.23,0,Math.PI*2,true);s.holes.push(bearing);
    const saddle=mesh(new T.ExtrudeGeometry(s,{depth:.075,bevelEnabled:true,bevelThickness:.008,bevelSize:.008,bevelSegments:1}),silver,[sx*1.88,0,0]);saddle.rotation.y=Math.PI/2;
    ring(.255,.032,[sx*1.94,-.2,0],edge,'x');
    for(const z of [-.98,.98])bolt([sx*1.99,.02,z],'x');
  }
  // Perforated horizontal mounting shelves visible in top view.
  for(const sx of [-1,1]) {
    const holes:number[][]=[];
    for(let x=1.91;x<2.81;x+=.22)for(let z=-1.42;z<=1.43;z+=.24)holes.push([sx*x,z,.034]);
    const pts=[[1.72,-2.8],[2.08,-2.8],[2.15,-2.25],[2.95,-1.22],[2.95,1.22],[2.15,2.25],[2.08,2.8],[1.72,2.8]].map(([x,z])=>[sx*x,z]);
    cutPlate(pts,holes,.065,[0,-.08,0],silver,true);
    box(.095,.13,5.55,[sx*1.79,.02,0]);
    for(const z of [-2.65,2.65]){box(.4,.09,.38,[sx*1.86,.11,z]);for(const x of [-.1,.1])bolt([sx*1.86+x,.17,z],'y');}
  }
  // Inside: stacked trays, restrained electronics, tie rods, cables.
  part='舱内设备';
  for(const y of [-.94,.48])box(2.25,.055,4.95,[0,y,0]);
  for(const x of [-1.08,1.08])for(const y of [-.9,.52])rod([x,y,-2.65],[x,y,2.65],.034);
  for(const z of [-1.65,.2,1.65]) {
    box(1.24,.75,.86,[.17,-.51,z],plate);
    box(1.34,.09,.94,[.17,-.1,z],black);
    for(let i=0;i<9;i++)box(.055,.1,.78,[-.36+i*.13,.02,z],edge);
    box(.83,.04,.62,[-.32,.57,z],green);
    for(let i=0;i<5;i++)box(.11,.055,.13,[-.6+i*.15,.62,z],black);
  }
  for(let i=0;i<5;i++) {
    const curve=new T.CatmullRomCurve3([new T.Vector3(-.7+i*.07,.62,1.9),new T.Vector3(-1.22+i*.035,.75,1.1),new T.Vector3(-1.23+i*.035,.03,-.7),new T.Vector3(-.6,-.22,-1.6)]);
    mesh(new T.TubeGeometry(curve,24,.013,5,false),i%2?black:gold);
  }
  // Split shell clamps have real radial thickness and insulating liners.
  // The two axial stations support both the GNSS saddle and lower winch cradle.
  for(const z of [-.48,.48]) {
    part='GNSS 与收放机构舱体抱箍';
    for(const bottom of [false,true]) {
      const a=bottom?Math.PI+.025:.025,b=bottom?2*Math.PI-.025:Math.PI-.025;
      const band=new T.Shape();band.absarc(0,0,1.735,a,b,false);
      band.absarc(0,0,1.675,b,a,true);band.closePath();
      mesh(new T.ExtrudeGeometry(band,{depth:.18,bevelEnabled:true,bevelSize:.005,bevelThickness:.005,bevelSegments:1,curveSegments:64}),silver,[0,0,z-.09]);
      const liner=new T.Shape();liner.absarc(0,0,1.673,a,b,false);liner.absarc(0,0,1.652,b,a,true);liner.closePath();
      mesh(new T.ExtrudeGeometry(liner,{depth:.17,bevelEnabled:false,curveSegments:64}),black,[0,0,z-.085]);
    }
    for(const sx of [-1,1]) {
      for(const y of [-.065,.065])box(.28,.055,.23,[sx*1.79,y,z]);
      rod([sx*1.85,-.15,z],[sx*1.85,.15,z],.026,edge);
      bolt([sx*1.85,.112,z],'y');
      cyl(.049,.045,[sx*1.85,-.123,z],edge);
    }
    part='GNSS 天线抱箍支座';
    for(const x of [-.27,.27])box(.12,.16,.22,[x,1.746,z]);
    box(.82,.075,.25,[0,1.81,z]);
    for(const x of [-.3,.3])bolt([x,1.858,z],'y');
    part='绞盘抱箍吊架';
    for(const x of [-.4,.4]) {
      box(.1,.43,.18,[x,-1.83,z]);
      bolt([x,-1.74,z+.11]);
    }
    box(1.16,.08,.23,[0,-2.07,z]);
  }
  part='GNSS 天线安装底座';
  box(.74,.09,1.19,[0,1.86,0]);
  cyl(.35,.12,[0,1.95,0]);
  for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2;bolt([.29*Math.cos(a),2.025,.29*Math.sin(a)],'y');}
  // Central GNSS antenna: mast terminates on the bolted saddle above the clamps.
  part='GNSS 天线';
  cyl(.22,.18,[0,2.06,0]);
  cyl(1.47,.58,[0,2.38,0],black,'y',root,.39);
  ring(1.47,.035,[0,2.68,0],edge,'y');
  const dome=mesh(new T.SphereGeometry(1.46,80,32,0,Math.PI*2,0,Math.PI/2),silver,[0,2.7,0]);dome.scale.y=.45;
  cyl(1.47,.045,[0,2.69,0]);
  for(const sx of [-1,1]) {
    part='立柱与支架';cyl(.19,2.04,[sx*2.62,1.11,0]);cyl(.23,.27,[sx*2.62,2.2,0]);
    cyl(.28,.19,[sx*2.62,.2,0]);cyl(.34,.09,[sx*2.62,.08,0]);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;bolt([sx*2.62+.27*Math.cos(a),.14,.27*Math.sin(a)],'y');}
  }
  // Four identical thrusters; shafts are diagonal in the horizontal plane.
  for(const sx of [-1,1])for(const sz of [-1,1]) {
    part='45°舵机与联轴器';
    const assembly=new T.Group();assembly.position.set(sx*2.12,.44,sz*1.3);
    assembly.rotation.y=Math.atan2(sx,sz);root.add(assembly);
    box(.58,.66,.88,[0,-.05,.12],plate,assembly);
    box(.63,.08,1.02,[0,-.41,.12],silver,assembly);
    // Closed cover over the former exposed board; perimeter seam and corner screws.
    box(.60,.024,.91,[0,.291,.12],black,assembly);
    box(.62,.085,.94,[0,.345,.12],plate,assembly);
    box(.48,.025,.72,[0,.4,.12],edge,assembly);
    for(const x of [-.245,.245])for(const z of [-.26,.5])bolt([x,.397,z],'y',assembly);
    cyl(.22,.36,[0,.02,.69],edge,'z',assembly);
    cyl(.185,.065,[0,.02,.9],gold,'z',assembly);
    cyl(.19,.11,[0,.02,.985],silver,'z',assembly);
    cyl(.16,.24,[0,.02,1.13],silver,'z',assembly);
    for(const x of [-.24,.24])box(.075,.66,.61,[x,-.07,.7],silver,assembly);
    part='导管推进器';
    const th=new T.Group();th.position.set(0,.02,1.93);assembly.add(th);
    th.name=`thruster-${sx}-${sz}`;
    th.userData.motionPivot=true;
    // Invert the complete pod about its servo shaft. Movement endpoints still
    // face diagonally forward; only the installation and transition change.
    th.userData.restAngle=Math.PI;
    th.rotation.z=th.userData.restAngle;
    th.userData.motionAngle=Math.PI-sx*Math.PI/2;
    movingThrusters.push({frame:assembly,thruster:th});
    // Thick hollow duct with upper/lower seams: no solid disc blocking its opening.
    const profile=[new T.Vector2(.695,-.35),new T.Vector2(.76,-.35),new T.Vector2(.78,-.31),new T.Vector2(.78,.29),new T.Vector2(.75,.34),new T.Vector2(.695,.34),new T.Vector2(.69,.26),new T.Vector2(.69,-.29),new T.Vector2(.695,-.35)];
    mesh(new T.LatheGeometry(profile,64),plate,[0,0,0],th);
    for(const y of [-.32,.18,.31])ring(.772,.015,[0,y,0],edge,'y',th);
    const nose=mesh(new T.SphereGeometry(.29,32,24),plate,[0,.34,0],th);nose.scale.y=2.08;
    ring(.29,.012,[0,.54,0],edge,'y',th);
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2,dx=Math.cos(a),dz=Math.sin(a);
      rod([dx*.24,.68,dz*.24],[dx*.71,.3,dz*.71],.029,silver,th);
      box(.11,.19,.046,[dx*.777,.21,dz*.777],edge,th).rotation.y=-a+Math.PI/2;
      cyl(.025,.035,[dx*.782,.23,dz*.782],silver,'z',th);
    }
    const rotor=new T.Group();rotor.position.y=-.075;
    rotor.userData.propeller=true;rotor.userData.spinDirection=sx*sz;
    th.add(rotor);
    cyl(.19,.12,[0,0,0],edge,'y',rotor);
    for(let i=0;i<3;i++) {
      const blade=new T.Shape();blade.moveTo(.17,0);blade.bezierCurveTo(.25,.14,.53,.29,.66,.15);blade.bezierCurveTo(.72,.04,.49,-.07,.2,-.075);blade.closePath();
      const b=mesh(new T.ExtrudeGeometry(blade,{depth:.025,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:1}),black,[0,0,0],rotor);b.rotation.set(Math.PI/2,0,i*Math.PI*2/3);b.rotateX(.18);
    }
    ring(.075,.012,[0,.76,.18],black,'z',th);
  }
  for(const sx of [-1,1]) {
    // The top view places these on the mid-side sheet, not on a descending leg.
    part='侧向圆柱碳纤维安装板';
    box(.92,.035,.94,[sx*2.5,.025,0],carbon);
    box(.035,.7,.94,[sx*2.94,-.335,0],carbon);
    for(const z of [-.35,.35]) {
      bolt([sx*2.22,.055,z],'y');
      bolt([sx*2.78,.055,z],'y');
    }
    part='左右侧横向圆柱';
    cyl(.29,.35,[sx*3.125,-.335,0],silver,'x');
    cyl(.32,.04,[sx*2.975,-.335,0],edge,'x');
    ring(.255,.022,[sx*3.31,-.335,0],edge,'x');
    for(let i=0;i<4;i++) {
      const a=Math.PI/4+i*Math.PI/2;
      bolt([sx*3.015,-.335+.275*Math.cos(a),.275*Math.sin(a)],'x');
    }
  }
  // Static servo-driven winch; the previously inferred hanging load is omitted.
  part='电磁铁收放绞盘';
  const wy=-2.13;
  for(const x of [-.52,.52]) {
    box(.09,.61,.43,[x,wy+.05,0]);
    cyl(.14,.13,[x,wy,0],edge,'x');
    ring(.108,.018,[x+.075,wy,0],black,'x');
    for(const z of [-.15,.15])bolt([x,wy+.29,z],'y');
  }
  cyl(.065,1.49,[.06,wy,0],silver,'x');
  cyl(.17,.73,[0,wy,0],edge,'x');
  for(const x of [-.39,.39]) {
    cyl(.3,.045,[x,wy,0],silver,'x');
    ring(.278,.012,[x,wy,0],edge,'x');
  }
  const winding:T.Vector3[]=[];
  for(let i=0;i<=640;i++) {
    const t=i/640,a=t*32*Math.PI;
    winding.push(new T.Vector3(-.35+t*.7,wy+.195*Math.cos(a),.195*Math.sin(a)));
  }
  mesh(new T.TubeGeometry(new T.CatmullRomCurve3(winding),640,.014,5,false),black);
  part='收放舵机与联轴器';
  box(.39,.55,.52,[.93,wy+.05,0],plate);
  box(.43,.045,.56,[.93,wy+.35,0],silver);
  box(.33,.03,.45,[.93,wy+.39,0],edge);
  for(const x of [.8,1.06])for(const z of [-.19,.19])bolt([x,wy+.42,z],'y');
  cyl(.11,.19,[.655,wy,0],silver,'x');
  for(const x of [.59,.71])ring(.112,.015,[x,wy,0],black,'x');
  box(.52,.085,1.14,[.92,-2.43,0]);
  for(const z of [-.48,.48]) {
    box(.1,.36,.16,[.7,-2.25,z]);
    box(.23,.07,.18,[.64,-2.08,z]);
    bolt([.66,-2.03,z],'y');
  }
  // Batch repeated rigid surfaces by selectable part and material to limit draw calls.
  root.updateMatrixWorld(true);
  const batches=new Map<string,{g:T.BufferGeometry[];m:T.Material;name:string;note:string}>();
  root.traverse(o=>{if(!(o instanceof T.Mesh))return;const m=o.material as T.Material;
    let ancestor:T.Object3D|null=o;
    while(ancestor){if(ancestor.userData.motionPivot)return;ancestor=ancestor.parent;}
    const key=o.userData.partName+m.uuid;let b=batches.get(key);
    if(!b){b={g:[],m,name:o.userData.partName,note:o.userData.partNote};batches.set(key,b);}
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    // Reflected left/right sheet profiles need their face winding restored.
    if(o.matrixWorld.determinant()<0)for(const attr of Object.values(g.attributes)) {
      const a=attr as T.BufferAttribute;
      for(let i=0;i<a.count;i+=3)for(let j=0;j<a.itemSize;j++) {
        const p=(i+1)*a.itemSize+j,q=(i+2)*a.itemSize+j,v=a.array[p];
        a.array[p]=a.array[q];a.array[q]=v;
      }
    }
    b.g.push(g);o.geometry.dispose();
  });
  const result=new T.Group();
  batches.forEach(b=>{const g=mergeGeometries(b.g);b.g.forEach(x=>x.dispose());if(!g)return;
    const o=new T.Mesh(g,b.m);o.userData={partName:b.name,partNote:b.note};o.castShadow=b.m!==glass;o.receiveShadow=true;result.add(o);
  });
  for(const {frame,thruster} of movingThrusters) {
    const carrier=new T.Group();
    frame.matrixWorld.decompose(carrier.position,carrier.quaternion,carrier.scale);
    carrier.add(thruster);
    thruster.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
    result.add(carrier);
  }
  return result;
}
