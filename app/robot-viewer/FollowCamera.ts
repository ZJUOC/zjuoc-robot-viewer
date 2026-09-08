import * as T from 'three';

/** Fixed elevated third-person view; forward is the body's yaw, not its wave tilt. */
export function updateFollowCamera(camera:T.PerspectiveCamera,center:T.Vector3,heading:number,target:T.Vector3,zoom=1) {
  const front=new T.Vector3(Math.sin(heading),0,Math.cos(heading));
  const scale=Math.max(1,.95/camera.aspect);
  target.copy(center).addScaledVector(front,.8);
  camera.position.copy(target).addScaledVector(front,-(12*scale+.8)*zoom);
  camera.position.y+=14*scale*zoom;
  camera.up.set(0,1,0);
  camera.lookAt(target);
}
