
const $=s=>document.querySelector(s);
const fileInput=$("#resumeFile"),dropzone=$("#dropzone"),fileTitle=$("#fileTitle"),fileHint=$("#fileHint"),fileStatus=$("#fileStatus"),jd=$("#jobDescription"),jdCount=$("#jdCount"),analyze=$("#analyzeBtn"),demo=$("#demoBtn"),status=$("#modelStatus"),results=$("#results");
let selectedFile=null,extracting=false,embedder=null,pipeline=null;

const SKILLS=["javascript","typescript","python","java","c++","c#","react","angular","vue","node.js","node","express","sql","mysql","postgresql","mongodb","aws","azure","gcp","docker","kubernetes","git","github","html","css","excel","power bi","tableau","figma","photoshop","project management","project coordination","leadership","communication","problem solving","data analysis","machine learning","artificial intelligence","natural language processing","sales","marketing","recruitment","human resources","hr","administration","operations","customer service","account management","financial analysis","risk management","research","writing","seo","social media","content creation"];
const STOP=new Set("the and for with from that this your have will are was were has our you not but all can job role work years into using their they about which who more than also other as an to of in on at is be by or".split(" "));

fileInput.addEventListener("change",()=>setFile(fileInput.files[0]));
["dragenter","dragover"].forEach(e=>dropzone.addEventListener(e,ev=>{ev.preventDefault();dropzone.classList.add("drag")}));
["dragleave","drop"].forEach(e=>dropzone.addEventListener(e,ev=>{ev.preventDefault();dropzone.classList.remove("drag")}));
dropzone.addEventListener("drop",ev=>setFile(ev.dataTransfer.files[0]));
jd.addEventListener("input",()=>jdCount.textContent=jd.value.length.toLocaleString()+" characters");

function setFile(file){
 if(!file)return;
 if(!/\.(pdf|docx|txt)$/i.test(file.name)){fileStatus.textContent="Please select a PDF, DOCX or TXT file.";return}
 selectedFile=file;fileTitle.textContent=file.name;fileHint.textContent=formatBytes(file.size);fileStatus.textContent="Ready to analyze";analyze.disabled=false;
}
function formatBytes(n){return n<1024?n+" B":n<1048576?(n/1024).toFixed(1)+" KB":(n/1048576).toFixed(1)+" MB"}

async function extract(file){
 const ext=file.name.toLowerCase().split(".").pop();
 if(ext==="txt")return await file.text();
 if(ext==="docx"){const {default:mammoth}=await import("https://cdn.jsdelivr.net/npm/mammoth@1.8.0/+esm");const ab=await file.arrayBuffer();const r=await mammoth.extractRawText({arrayBuffer:ab});return r.value}
 const pdfjsLib=await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
 const ab=await file.arrayBuffer(),pdf=await pdfjsLib.getDocument({data:ab}).promise,out=[];
 for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i),tc=await p.getTextContent();out.push(tc.items.map(x=>x.str).join(" "))}
 return out.join("\n");
}

function words(text){return (text.toLowerCase().match(/[a-z][a-z0-9+#.-]{1,}/g)||[]).filter(w=>!STOP.has(w)&&w.length>2)}
function terms(text){const counts={};words(text).forEach(w=>counts[w]=(counts[w]||0)+1);return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(x=>x[0])}
function skillList(text){const l=text.toLowerCase();return SKILLS.filter(s=>l.includes(s)).map(s=>s.replace(/\b\w/g,c=>c.toUpperCase()))}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function chipList(id,items){$(id).innerHTML=items.length?items.slice(0,30).map(x=>'<span class="chip">'+esc(x)+"</span>").join(""):'<span style="color:#8a93a2;font-size:11px">None detected</span>'}

function heuristicMatch(resume,jdText){
 const rWords=new Set(words(resume)),jWords=terms(jdText).slice(0,45),matched=jWords.filter(x=>rWords.has(x)),missing=jWords.filter(x=>!rWords.has(x));
 const rs=skillList(resume),js=skillList(jdText),skillMatched=js.filter(x=>rs.includes(x));
 const lexical=jWords.length?Math.round(matched.length/jWords.length*100):72,skillScore=js.length?Math.round(skillMatched.length/js.length*100):lexical;
 return {matched,missing,score:Math.round(lexical*.55+skillScore*.45),skillMatched,js};
}

async function semanticSimilarity(a,b){
 if(!b.trim())return .72;
 status.textContent="Loading local AI model for semantic job matching…";
 try{
  if(!pipeline){const t=await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3");pipeline=t.pipeline;t.env.allowLocalModels=false;t.env.useBrowserCache=true;}
  if(!embedder)embedder=await pipeline("feature-extraction","Xenova/all-MiniLM-L6-v2",{dtype:"q8"});
  const [ea,eb]=await Promise.all([embedder(a.slice(0,5000),{pooling:"mean",normalize:true}),embedder(b.slice(0,5000),{pooling:"mean",normalize:true})]);
  let sum=0;for(let i=0;i<ea.data.length;i++)sum+=ea.data[i]*eb.data[i];
  return Math.max(0,Math.min(1,sum));
 }catch{return .72}
}

function quality(resume){
 const l=resume.toLowerCase(),sections=["experience","education","skills"],sectionScore=sections.filter(x=>l.includes(x)).length/3;
 const bullets=(resume.match(/[•·]|\n\s*[-*]/g)||[]).length,numbers=(resume.match(/\b\d+(?:\.\d+)?%?\b/g)||[]).length;
 const email=/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(resume),phone=/\+?\d[\d\s().-]{7,}/.test(resume),length=Math.min(1,resume.length/2500);
 return Math.min(100,Math.round(35+sectionScore*25+Math.min(bullets,12)*1.5+Math.min(numbers,10)*1.5+(email?5:0)+(phone?5:0)+length*10));
}
function renderScore(id,val){$(id).textContent=val+"%";$("#"+id.replace("Score","Bar")).style.width=val+"%"}
function signal(label,value,kind){return '<div class="signal"><b>'+esc(label)+'</b><span class="'+kind+'">'+esc(value)+"</span></div>"}

async function runAnalysis(){
 if(extracting)return;extracting=true;analyze.disabled=true;status.textContent="Reading your resume…";
 try{
  const resume=await extract(selectedFile);if(resume.trim().length<80)throw new Error("Very little readable text was found.");
  const job=jd.value.trim(),h=heuristicMatch(resume,job),sem=job?Math.round((await semanticSimilarity(resume,job))*100):72;
  const match=job?Math.round(h.score*.55+sem*.45):72,q=quality(resume),kw=job?h.score:Math.min(100,Math.round(terms(resume).length/2)),ats=Math.round(match*.45+q*.35+kw*.2);
  $("#atsScore").textContent=ats;$(".score-ring").style.background="conic-gradient(var(--accent) "+ats*3.6+"deg,#e9ebf1 0deg)";
  $("#atsLabel").textContent=ats>=80?"Strong ATS profile":ats>=65?"Good, but can improve":"Needs improvement";
  renderScore("matchScore",match);renderScore("qualityScore",q);renderScore("keywordScore",kw);
  chipList("#matchedKeywords",job?h.matched:skillList(resume));chipList("#missingKeywords",job?h.missing.slice(0,25):[]);chipList("#skills",skillList(resume));
  $("#matchedCount").textContent=job?h.matched.length:skillList(resume).length;$("#missingCount").textContent=job?h.missing.length:0;$("#skillsCount").textContent=skillList(resume).length;
  const action=/\b(led|managed|developed|created|improved|increased|reduced|delivered|coordinated|implemented)\b/i.test(resume),metrics=/\d+(?:\.\d+)?%|\$|₹|\b\d+\+/.test(resume);
  $("#signals").innerHTML=[
   signal("Contact details",/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(resume)&&/\+?\d[\d\s().-]{7,}/.test(resume)?"Detected":"Check email & phone","good"),
   signal("Core sections",["experience","education","skills"].filter(x=>resume.toLowerCase().includes(x)).length>=3?"Complete":"Review sections",["experience","education","skills"].filter(x=>resume.toLowerCase().includes(x)).length>=3?"good":"warn"),
   signal("Action language",action?"Present":"Add stronger verbs",action?"good":"warn"),
   signal("Measurable results",metrics?"Detected":"Add metrics",metrics?"good":"warn")
  ].join("");
  const suggestions=[];
  if(job&&h.missing.length)suggestions.push("Add relevant keywords only where they accurately describe your experience: "+h.missing.slice(0,6).join(", ")+".");
  if(!action)suggestions.push("Rewrite responsibility-heavy bullets with strong action verbs and outcomes.");
  if(!metrics)suggestions.push("Add measurable results such as percentages, volumes, time saved, budgets or team size.");
  if(!/skills/i.test(resume))suggestions.push("Add a clear Skills section with role-relevant tools and competencies.");
  suggestions.push("Keep formatting simple: standard headings, readable dates, consistent bullet points and no important information inside images.");
  $("#suggestions").innerHTML=suggestions.map((s,i)=>'<div class="suggestion"><span class="suggestion-num">'+(i+1)+'</span><span>'+esc(s)+"</span></div>").join("");
  $("#suggestionCount").textContent=suggestions.length;$("#resultMeta").textContent=selectedFile.name+" · "+(job?"Compared with the supplied job description":"General ATS-style resume review");
  results.hidden=false;status.textContent="Analysis complete. AI semantic matching runs locally in your browser.";results.scrollIntoView({behavior:"smooth",block:"start"});
 }catch(e){status.textContent=e.message||"Could not analyze this file."}
 finally{extracting=false;analyze.disabled=!selectedFile}
}

demo.addEventListener("click",()=>{
 const text="Mohammed Shakeel\nAdministrative & Executive Support Professional\nEmail: shakeel@example.com | +91 98765 43210\n\nSUMMARY\nAdministrative professional with 7+ years of experience supporting senior leadership, parliamentary administration, project coordination and confidential documentation.\n\nEXPERIENCE\nPersonal Assistant to Member of Parliament — Parliament of India\nManaged schedules, official correspondence, stakeholder coordination and confidential documents. Coordinated meetings and parliamentary requirements.\n\nSKILLS\nExecutive Liaison, Project Management, Document Management, Scheduling, Microsoft Office, Communication, Research\n\nEDUCATION\nBachelor's Degree";
 const blob=new Blob([text],{type:"text/plain"});setFile(new File([blob],"demo-resume.txt",{type:"text/plain"}));
 jd.value="Executive Assistant supporting senior leadership. Requirements: calendar management, executive communication, stakeholder coordination, document management, project coordination, Microsoft Office, confidentiality and strong organizational skills.";jd.dispatchEvent(new Event("input"));
});
analyze.addEventListener("click",runAnalysis);$("#newBtn").addEventListener("click",()=>{results.hidden=true;window.scrollTo({top:0,behavior:"smooth"})});