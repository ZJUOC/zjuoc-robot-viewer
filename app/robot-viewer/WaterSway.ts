/** Small, bounded, non-synchronous motion. Angles in radians, heave in metres. */
export function waterSway(time:number,strength:number) {
  const weight=Math.max(0,Math.min(1,strength))*1.5;
  return {
    pitch:weight*(.48*Math.sin(time*1.43)+.17*Math.sin(time*2.17+.9))*Math.PI/180,
    roll:weight*(.62*Math.sin(time*1.11+.6)+.23*Math.sin(time*1.87+2.1))*Math.PI/180,
    heave:weight*(.0022*Math.sin(time*1.31+.3)+.0008*Math.sin(time*2.03+1.7)),
  };
}
