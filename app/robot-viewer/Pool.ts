import * as T from 'three';

export function createPool(unitsPerMeter:number) {
  const width=3*unitsPerMeter,length=5*unitsPerMeter,depth=1.5*unitsPerMeter;
  const bottom=-depth/2,top=depth/2,group=new T.Group();
  const tile=new T.MeshStandardMaterial({color:0x79bdc9,roughness:.48,metalness:.06});
  const coping=new T.MeshStandardMaterial({color:0xd3dad9,roughness:.7});
  const addBox=(x:number,y:number,z:number,p:number[],m:T.Material)=>{
    const o=new T.Mesh(new T.BoxGeometry(x,y,z),m);o.position.set(...p as [number,number,number]);o.receiveShadow=true;group.add(o);
  };
  const thickness=.08*unitsPerMeter;
  addBox(width+2*thickness,thickness,length+2*thickness,[0,bottom-thickness/2,0],tile);
  for(const s of [-1,1]){
    addBox(thickness,depth,length+2*thickness,[s*(width+thickness)/2,0,0],tile);
    addBox(width,depth,thickness,[0,0,s*(length+thickness)/2],tile);
    addBox(thickness*2,.06*unitsPerMeter,length+4*thickness,[s*(width+thickness)/2,top,0],coping);
    addBox(width,.06*unitsPerMeter,thickness*2,[0,top,s*(length+thickness)/2],coping);
  }
  const lines:number[]=[];
  const segment=(a:number[],b:number[])=>lines.push(...a,...b);
  const eps=.025;
  // 10 cm grout grid on the pool bottom and all four inner walls.
  for(let i=0;i<=30;i++){
    const x=-width/2+i*.1*unitsPerMeter;
    segment([x,bottom+eps,-length/2],[x,bottom+eps,length/2]);
    for(const s of [-1,1])segment([x,bottom,s*(length/2-eps)],[x,top,s*(length/2-eps)]);
  }
  for(let i=0;i<=50;i++){
    const z=-length/2+i*.1*unitsPerMeter;
    segment([-width/2,bottom+eps,z],[width/2,bottom+eps,z]);
    for(const s of [-1,1])segment([s*(width/2-eps),bottom,z],[s*(width/2-eps),top,z]);
  }
  for(let i=0;i<=15;i++){
    const y=bottom+i*.1*unitsPerMeter;
    for(const s of [-1,1]){
      segment([s*(width/2-eps),y,-length/2],[s*(width/2-eps),y,length/2]);
      segment([-width/2,y,s*(length/2-eps)],[width/2,y,s*(length/2-eps)]);
    }
  }
  group.add(new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(lines,3)),new T.LineBasicMaterial({color:0x32798b,transparent:true,opacity:.46})));
  const stripe=new T.MeshStandardMaterial({color:0x164c69,roughness:.6});
  addBox(.045*unitsPerMeter,.025,length*.9,[0,bottom+.035,0],stripe);
  for(let i=0;i<=10;i++){
    const z=-length/2+i*.5*unitsPerMeter;
    for(const s of [-1,1])addBox(.22*unitsPerMeter,.025,.025*unitsPerMeter,[s*(width/2-.11*unitsPerMeter),bottom+.035,z],stripe);
  }
  const water=new T.Mesh(new T.PlaneGeometry(width,length),new T.MeshPhysicalMaterial({color:0x52cdd7,transparent:true,opacity:.14,metalness:.12,roughness:.13,side:T.DoubleSide,depthWrite:false}));
  water.rotation.x=-Math.PI/2;water.position.y=top-.03;group.add(water);
  return {group,width,length,depth,bottom,top};
}
