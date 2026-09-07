import styles from './robot-viewer.module.css';

const controls=[
  {code:'KeyW',key:'W',label:'前进',row:1,col:'3'},
  {code:'KeyA',key:'A',label:'左移',row:2,col:'2'},
  {code:'KeyS',key:'S',label:'后退',row:2,col:'3'},
  {code:'KeyD',key:'D',label:'右移',row:2,col:'4'},
  {code:'KeyJ',key:'J',label:'左转',row:2,col:'6'},
  {code:'KeyK',key:'K',label:'右转',row:2,col:'7'},
  {code:'ShiftLeft',key:'Shift',label:'上浮',row:3,col:'1 / 3'},
  {code:'ControlLeft',key:'Ctrl',label:'下潜',row:4,col:'1 / 3'},
];

export function ControlKeyboard({pressed}:{pressed:string[]}) {
  const send=(code:string,down:boolean)=>window.dispatchEvent(new CustomEvent('robot-move',{detail:{code,down}}));
  return <section className={styles.swimPad} aria-label="运动控制键盘">
    <div className={styles.keyboardHeading}><span>实时按键</span><small>机器人响应延迟 1 秒</small></div>
    <div className={styles.keyboardKeys}>
      {controls.map(c=>{
        const active=pressed.includes(c.code)||(c.code==='ShiftLeft'&&pressed.includes('ShiftRight'))||(c.code==='ControlLeft'&&pressed.includes('ControlRight'));
        return <button key={c.code} type="button" style={{gridRow:c.row,gridColumn:c.col}} aria-label={`${c.key} ${c.label}`} aria-pressed={active}
          onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);send(c.code,true);}}
          onPointerUp={()=>send(c.code,false)} onPointerCancel={()=>send(c.code,false)} onLostPointerCapture={()=>send(c.code,false)}
          onKeyDown={e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();send(c.code,true);}}}
          onKeyUp={e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();send(c.code,false);}}}
          onBlur={()=>send(c.code,false)}><strong>{c.key}</strong><small>{c.label}</small></button>;
      })}
      <p className={styles.keyboardNote}>亮起代表当前输入<br/>松开后，机器人仍需 1 秒才收到松键信号</p>
    </div>
  </section>;
}
