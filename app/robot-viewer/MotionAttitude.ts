import * as T from 'three';

/** World-space lean: the side in the horizontal travel direction is lower. */
export function movementLean(velocity:T.Vector3,target:T.Quaternion) {
  const speed=Math.hypot(velocity.x,velocity.z);
  if(speed<.001)return target.identity();
  // Fade through small angles during starts/stops; cruising lean is 5–8°.
  const degrees=speed<2?5*speed/2:5+3*T.MathUtils.clamp((speed-2)/10,0,1);
  const angle=T.MathUtils.degToRad(degrees);
  const up=new T.Vector3(velocity.x/speed*Math.sin(angle),Math.cos(angle),velocity.z/speed*Math.sin(angle));
  return target.setFromUnitVectors(T.Object3D.DEFAULT_UP,up);
}
