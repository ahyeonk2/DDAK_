export type Task = { id: string; title: string; done: boolean; due: string; traces: string[] };
export type Member = { id: string; name: string; values: string[]; tasks: Task[] };
export type Project = { id: string; ownerId?: string; inviteCode?: string; name: string; course: string; due: string; goal: string; members: Member[]; scope: string[]; later: string[]; excluded: string[]; initialScope: number; history: {added:string; removed:string; date:string}[]; archived: boolean };
export type Store = { projects: Project[]; activeId: string; memberId: string };
export const uid = () => crypto.randomUUID();
export const dateOffset = (days:number) => { const d = new Date(); d.setDate(d.getDate()+days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const today = () => dateOffset(0);
export const daysLeft = (date:string) => Math.round((new Date(date+'T00:00:00').getTime()-new Date(today()+'T00:00:00').getTime())/86400000);
export const VALUES = ['높은 성적','결과물 완성도','새로운 툴 경험','새로운 역할 경험','포트폴리오 활용','공모전 확장','무리하지 않고 마무리'];
export function seed(): Store {
 const names=['아현','민지','지수','하린'];
 const titles=[['레퍼런스 조사','와이어프레임 수정','프로토타입 연결'],['인터뷰 정리','사용자 플로우','발표 구성'],['비주얼 방향 설정','메인 화면 디자인','디자인 시스템 정리'],['경쟁 서비스 조사','서브 화면 디자인','발표 자료 정리']];
 const members=names.map((name,i)=>({id:uid(),name,values:['결과물 완성도','무리하지 않고 마무리'],tasks:titles[i].map((title,j)=>({id:uid(),title,done:j===0,due:dateOffset(j===1?0:4),traces:[]}))}));
 const p:Project={id:uid(),name:'Interaction Design',course:'인터랙션 디자인 · 3조',due:dateOffset(12),goal:'수업 안에서 완성도 높은 프로토타입을 만든다.',members,scope:['사용자 인터뷰','사용자 플로우','주요 화면 디자인','프로토타입','발표 자료'],later:['모션 인터랙션'],excluded:['공모전 출품','프로모션 영상','추가 기능 개발'],initialScope:5,history:[],archived:false};
 return {projects:[p],activeId:p.id,memberId:members[0].id};
}
export const STORAGE_KEY='deoreonae-projects-v1';
export function load():Store { try {const raw=localStorage.getItem(STORAGE_KEY);if(raw){const v=JSON.parse(raw);if(Array.isArray(v.projects)&&v.projects.length&&v.projects.every((p:Project)=>p.id&&Array.isArray(p.members)&&p.members.length&&Array.isArray(p.scope)&&Array.isArray(p.history)))return v;}}catch{}return seed(); }
