import * as T from 'three';

// World-space wake: existing particles retain their course when a pod turns.
export function createThrusterEffects(pivots:T.Object3D[],mobile:boolean) {
  const perPod=mobile?90:180,count=perPod*pivots.length;
  const positions=new Float32Array(count*3),colors=new Float32Array(count*3);
  const velocities=new Float32Array(count*3),ages=new Float32Array(count).fill(-1);
  const lifetime=1.15,cursors=pivots.map(()=>0),budgets=pivots.map(()=>0);
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('color',new T.BufferAttribute(colors,3).setUsage(T.DynamicDrawUsage));
  const size=32,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const i=(y*size+x)*4,r=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1);
    data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(Math.max(0,1-r)**2*210);
  }
  const map=new T.DataTexture(data,size,size);map.needsUpdate=true;
  const material=new T.PointsMaterial({map,size:.12,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending});
  const points=new T.Points(geometry,material);points.frustumCulled=false;
  const rotors:T.Object3D[]=[];pivots.forEach(p=>p.traverse(o=>{if(o.userData.propeller)rotors.push(o);}));
  let power=0;
  const position=new T.Vector3(),velocity=new T.Vector3(),q=new T.Quaternion();
  return {points,update(dt:number,enabled:boolean) {
    power=T.MathUtils.damp(power,enabled?1:0,enabled?5:8,dt);
    if(!enabled&&power<.001)power=0;
    for(const rotor of rotors)rotor.rotation.y=(rotor.rotation.y+dt*power*32*rotor.userData.spinDirection)%(Math.PI*2);
    for(let i=0;i<count;i++) {
      if(ages[i]<0)continue;ages[i]+=dt;
      if(ages[i]>=lifetime){ages[i]=-1;colors.fill(0,i*3,i*3+3);continue;}
      const fade=(1-ages[i]/lifetime)**2;
      for(let k=0;k<3;k++)positions[i*3+k]+=velocities[i*3+k]*dt;
      colors[i*3]=.45*fade;colors[i*3+1]=.8*fade;colors[i*3+2]=fade;
    }
    pivots.forEach((pivot,pod)=>{
      if(!enabled)return;
      budgets[pod]+=dt*perPod/lifetime*power;
      pivot.getWorldQuaternion(q);
      while(budgets[pod]>=1){
        budgets[pod]--;const i=pod*perPod+cursors[pod];cursors[pod]=(cursors[pod]+1)%perPod;
        const angle=Math.random()*Math.PI*2,r=.25+Math.random()*.36;
        position.set(Math.cos(angle)*r,.42,Math.sin(angle)*r);pivot.localToWorld(position);
        velocity.set(Math.cos(angle)*.22,2.5+Math.random()*1.2,Math.sin(angle)*.22).applyQuaternion(q);
        position.toArray(positions,i*3);velocity.toArray(velocities,i*3);ages[i]=0;
        colors.set([.45,.8,1],i*3);
      }
    });
    geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;
  },dispose(){map.dispose();}};
}
