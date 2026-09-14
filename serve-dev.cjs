const http=require('http'),fs=require('fs'),path=require('path');
const root=process.cwd();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json'};
const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);
  if(p==='/')p='/index.html';
  const f=path.join(root,p);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.writeHead(404);res.end('404');return;}
  const ext=path.extname(f);
  res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
});
server.listen(8898,()=>console.log('Serving on http://localhost:8898 (pid '+process.pid+')'));
