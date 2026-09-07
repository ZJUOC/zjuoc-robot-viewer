/** Visual servo rules; axes are constrained by the diagonal shaft geometry. */
export function thrusterCommand(horizontal:boolean,vertical:number,projection:number,fallback:number) {
  const rest=Math.PI;
  if(!horizontal&&vertical===0)return {angle:rest,power:0};
  // Pure ascent/descent uses the inverted, vertical installation in both cases.
  // The protruding +Y end is the primary water outlet. Jet momentum must
  // oppose the requested vehicle force, including when combining axes.
  const power=vertical<0?-1:1;
  if(!horizontal)return {angle:rest,power};
  const side=Math.abs(projection)>1e-5?Math.sign(projection):Math.sign(fallback)||1;
  return {angle:rest-side*power*(vertical===0?Math.PI/2:Math.PI/4),power};
}
