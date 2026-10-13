import{l as e,n as t}from"../main.js";import{t as n}from"./SceneCutscene.js";var r=[{role:`Sound Effects`,names:[`効果音ラボ`]},{role:`Font`,names:[`日比谷32（明朝体）`]},{role:`Game Design`,names:[`お躁式ラケッツ!`]}],i=class extends n{roll=document.createElement(`div`);constructor(e){super(`credits`,e),this.root.classList.add(`paper-scene`),this.roll.className=`credits-roll`,this.roll.innerHTML=`
            <div class="credits-title">The Scattered Days!</div>
            ${r.map(({role:e,names:t})=>`
                <div class="credits-section">
                    <div class="credits-role">${e}</div>
                    ${t.map(e=>`<div class="credits-name">${e}</div>`).join(``)}
                </div>
            `).join(``)}
        `,this.root.append(this.roll),this.startBgm()}async startBgm(){await Promise.all([t.bm.load({src:`assets/bgm/title.mp3`,trackVolume:.5}),e.sleep(2e3)]),await t.bm.play()}*script(){yield*this.fade(`var(--paper)`,1,0,60);let e=this.root.clientHeight;for(let t=e;t>-this.roll.offsetHeight;t-=e/600)this.roll.style.transform=`translateY(${t}px)`,yield;yield*this.fade(`var(--paper)`,0,1,60)}};export{i as SceneCredits};
//# sourceMappingURL=SceneCredits.js.map