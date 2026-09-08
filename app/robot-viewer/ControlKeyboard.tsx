import styles from './robot-viewer.module.css';

const controls=[
  {code:'KeyW',key:'W',label:'前进',row:1,col:'3'},
  {code:'KeyP',key:'P',label:'脱困',row:1,col:'7'},
  {code:'KeyA',key:'A',label:'左移',row:2,col:'2'},
  {code:'KeyS',key:'S',label:'后退',row:2,col:'3'},
  {code:'KeyD',key:'D',label:'右移',row:2,col:'4'},
  {code:'KeyJ',key:'J',label:'左转',row:2,col:'6'},
  {code:'KeyK',key:'K',label:'右转',row:2,col:'7'},
  {code:'ShiftLeft',key:'Shift',label:'下潜',row:3,col:'1 / 3'},
  {code:'Space',key:'Space',label:'上浮',row:4,col:'3 / 7'},
];

export function ControlKeyboard({pressed}:{pressed:string[]}) {
  const send=(code:string,down:boolean)=>window.dispatchEvent(new CustomEvent('robot-move',{detail:{code,down}}));
  return <section className={styles.swimPad} aria-label="运动控制键盘">
    <div className={styles.keyboardHeading}><span>实时按键</span><small>机器人响应延迟 1 秒</small></div>
    <div className={styles.keyboardKeys}>
      {controls.map(c=>{
        const active=pressed.includes(c.code)||(c.code==='ShiftLeft'&&pressed.includes('ShiftRight'));
        return <button key={c.code} type="button" style={{gridRow:c.row,gridColumn:c.col}} aria-label={`${c.key} ${c.label}`} aria-pressed={active}
          onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);send(c.code,true);}}
          onPointerUp={()=>send(c.code,false)} onPointerCancel={()=>send(c.code,false)} onLostPointerCapture={()=>send(c.code,false)}
          onKeyDown={e=>{if(e.code==='Enter'){e.preventDefault();send(c.code,true);}}}
          onKeyUp={e=>{if(e.code==='Enter'){e.preventDefault();send(c.code,false);}}}
          onBlur={()=>send(c.code,false)}><strong>{c.key}</strong><small>{c.label}</small></button>;
      })}
      <p className={styles.keyboardNote}>P 立即回到起点，不受延迟影响<br/>其余按键松开后仍有 1 秒延迟</p>
    </div>
  </section>;
}
