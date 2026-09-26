import * as T from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';
type Basket={colorIndex:number;center:T.Vector3;innerRadius:number;floorY:number;openingY:number};
export function createBallInteraction(balls:T.Object3D[],robot:T.Object3D,units:number,bottom:number,solids:T.Mesh[],baskets:Basket[]){
  let attached=-1;
  const starts=balls.map(b=>b.position.clone()),falling=balls.map(()=>false),scored=balls.map(()=>false),radius=.098*units;
  const obstacles=solids.map(m=>{m.updateWorldMatrix(true,false);m.geometry.computeBoundingBox();return new OBB().fromBox3(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld);});
  const sphere=new T.Sphere(new T.Vector3(),radius);
  const blocked=(p:T.Vector3,index:number)=>{
    sphere.center.copy(p);
    return p.y<bottom+radius-1e-6||p.y>bottom+1.5*units-radius||Math.abs(p.x)>1.5*units-radius||Math.abs(p.z)>2.5*units-radius||obstacles.some(o=>o.intersectsSphere(sphere))||balls.some((b,i)=>i!==index&&b.position.distanceTo(p)<radius*2-1e-6);
  };
  const anchor=(p:T.Vector3,q:T.Quaternion)=>new T.Vector3(0,-.225*units,0).applyQuaternion(q).add(p);
  const sweep=(from:T.Vector3,to:T.Vector3,index:number)=>{
    const n=Math.max(1,Math.ceil(from.distanceTo(to)/(.005*units))),p=new T.Vector3();let fraction=0;
    for(let i=1;i<=n;i++){p.lerpVectors(from,to,i/n);if(blocked(p,index))break;fraction=i/n;}return fraction;
  };
  const candidate=()=>balls.map((b,i)=>({i,d:robot.position.distanceTo(b.position)})).filter(({i})=>{
    const b=balls[i],h=(robot.position.y-b.position.y)/units;
    return h>=.14&&h<=.42&&Math.hypot(robot.position.x-b.position.x,robot.position.z-b.position.z)/units<=.14;
  }).sort((a,b)=>a.d-b.d)[0]?.i??-1;
  const release=()=>{if(attached>=0){falling[attached]=true;attached=-1;}};
  const enterBasket=(index:number,from:T.Vector3,to:T.Vector3)=>{
    const basket=baskets.find(item=>item.colorIndex===index);if(!basket||to.y>=from.y)return false;
    const crossing=basket.openingY+radius;
    if(from.y<crossing||to.y>crossing)return false;
    const t=(from.y-crossing)/(from.y-to.y),x=T.MathUtils.lerp(from.x,to.x,t),z=T.MathUtils.lerp(from.z,to.z,t);
    if(Math.hypot(x-basket.center.x,z-basket.center.z)>basket.innerRadius-radius)return false;
    balls[index].position.set(basket.center.x,basket.floorY+radius,basket.center.z);
    falling[index]=false;scored[index]=true;
    return true;
  };
  const interact=()=>{
    if(attached>=0){release();return;}
    const i=candidate();if(i<0)return;
    const target=anchor(robot.position,robot.quaternion);
    if(sweep(balls[i].position,target,i)<1)return;
    attached=i;falling[i]=false;balls[i].position.copy(target);
  };
  const blocksPose=(p:T.Vector3,q:T.Quaternion)=>attached>=0&&blocked(anchor(p,q),attached);
  const update=(dt:number)=>{
    balls.forEach((b,i)=>{
      if(i===attached){b.position.copy(anchor(robot.position,robot.quaternion));return;}
      if(!falling[i]||scored[i])return;
      const onStand=starts.some(s=>Math.hypot(b.position.x-s.x,b.position.z-s.z)<.16*units);
      const floor=bottom+(onStand?.158:.098)*units;
      const target=b.position.clone();target.y=Math.max(floor,target.y-.06*units*dt);
      if(enterBasket(i,b.position,target))return;
      const t=sweep(b.position,target,i);b.position.lerp(target,t);
      if(t<1||b.position.y<=floor)falling[i]=false;
    });
  };
  const reset=(resetScored=false)=>{attached=-1;balls.forEach((b,i)=>{if(resetScored||!scored[i])b.position.copy(starts[i]);falling[i]=false;if(resetScored)scored[i]=false;});};
  const hint=()=>attached>=0?`已吸附${balls[attached].name} · 按 L 释放`:scored.some(Boolean)?`已入筐：${scored.map((value,i)=>value?balls[i].name:'').filter(Boolean).join('、')}`:candidate()>=0?`按 L 吸附${balls[candidate()].name}`:'前往彩球上方，靠近后按 L 吸附（一次一颗）';
  return {interact,release,reset,update,hint,blocksPose};
}
