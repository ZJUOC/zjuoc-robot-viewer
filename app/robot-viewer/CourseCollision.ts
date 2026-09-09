import * as T from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';

/** Solid frame boxes and an oriented safety envelope enclosing the entire robot.
 * Substeps include rotation, so turning in place cannot cut through a post.
 */
export function createCourseCollision(robot:T.Object3D,solids:T.Mesh[],units:number,extraBlocked:(p:T.Vector3,q:T.Quaternion)=>boolean=()=>false) {
  const savedPosition=robot.position.clone(),savedRotation=robot.quaternion.clone();
  robot.position.set(0,0,0);robot.quaternion.identity();
  const bounds=new T.Box3();
  const pivots:T.Object3D[]=[];
  robot.traverse(o=>{if(o.userData.motionPivot)pivots.push(o);});
  const angles=pivots.map(o=>o.rotation.z);
  // Include every servo posture, rather than letting rotating pods escape the collider.
  for(let i=0;i<=24;i++){
    pivots.forEach(o=>o.rotation.z=Math.PI/2+i*Math.PI/24);
    robot.updateMatrixWorld(true);bounds.union(new T.Box3().setFromObject(robot));
  }
  pivots.forEach((o,i)=>o.rotation.z=angles[i]);
  robot.position.copy(savedPosition);robot.quaternion.copy(savedRotation);robot.updateMatrixWorld(true);
  const local=new OBB().fromBox3(bounds.expandByScalar(.002*units));
  const obstacles=solids.map(mesh=>{
    mesh.updateWorldMatrix(true,false);mesh.geometry.computeBoundingBox();
    return new OBB().fromBox3(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
  });
  const probe=new OBB(),matrix=new T.Matrix4(),scale=new T.Vector3(1,1,1);
  const position=new T.Vector3(),rotation=new T.Quaternion();
  const intersects=(p:T.Vector3,q:T.Quaternion)=>{
    matrix.compose(p,q,scale);probe.copy(local).applyMatrix4(matrix);
    return obstacles.some(o=>probe.intersectsOBB(o))||extraBlocked(p,q);
  };
  const resolve=(from:T.Vector3,fromRotation:T.Quaternion,to:T.Vector3,toRotation:T.Quaternion)=>{
    const steps=Math.max(1,Math.ceil(from.distanceTo(to)/(.01*units)),Math.ceil(fromRotation.angleTo(toRotation)/(Math.PI/180)));
    let fraction=0;
    for(let i=1;i<=steps;i++){
      const t=i/steps;position.lerpVectors(from,to,t);rotation.slerpQuaternions(fromRotation,toRotation,t);
      if(intersects(position,rotation))break;
      fraction=t;
    }
    to.lerpVectors(from,to,fraction);
    // The output must not alias slerp's second input: Three.js copies the
    // first input before interpolation, which otherwise erases the target yaw.
    rotation.slerpQuaternions(fromRotation,toRotation,fraction);
    toRotation.copy(rotation);
    return fraction;
  };
  const rebound=(p:T.Vector3,q:T.Quaternion,velocity:T.Vector3,limits:T.Box3)=>{
    if(velocity.lengthSq()<1e-8)return;
    const target=p.clone().addScaledVector(velocity,-.04*units/velocity.length()).clamp(limits.min,limits.max);
    resolve(p.clone(),q.clone(),target,q.clone());
    p.copy(target);
  };
  return {resolve,intersects,bounds,rebound};
}
