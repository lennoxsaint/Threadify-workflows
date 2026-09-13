import { pathToFileURL } from 'node:url';
import { Store } from '../../tools/inbound/store.mjs';
export function demo(root, count = 8) {
  if (!root) throw new Error('Pass a dedicated demo state directory');
  const store = new Store(root);
  store.configure({version:1,account:'@example',preference:'five',timezone:'UTC'});
  const end = new Date(), start = new Date(end.getTime()-864e5);
  const posts = [
    {id:'synthetic-garden',verified:true,text:'I planted herbs on the kitchen windowsill this weekend.\n\nThe basil is doing well. The mint has already taken over its corner. Next experiment: a smaller pot and a little less water.',url:'https://www.threads.com/example-garden',metrics:{views:1240,likes:48,replies:8,reposts:2,quotes:0,shares:3},metrics_checked_at:end.toISOString(),metrics_as_of:end.toISOString()},
    {id:'synthetic-walk',verified:true,text:'An evening walk with no headphones.\n\nI noticed a tiny bookshop two streets from home that I have walked past for years. Going back tomorrow.',url:'https://www.threads.com/example-walk',metrics:{views:680,likes:21,replies:4},metrics_checked_at:end.toISOString()}
  ];
  const comments=['What herbs would you try next?','The mint always wins in our house too.','Love this little experiment!','Did you grow the basil from seed?','I needed this reminder to start small.','Your windowsill sounds lovely.','What was the name of the bookshop?','I found a pottery studio on my last walk!'];
  const replies=['Thinking about parsley next. What grows well for you?','It really does take that corner personally 😂','Thank you! It has been fun watching them grow.','I started with a small plant this time.','One pot was a good starting point for me.','It gets the nicest afternoon light.','I will check the name when I go back.','That sounds like a lovely find!'];
  const snapshot={version:1,account:'@example',start:start.toISOString(),end:end.toISOString(),coverage:{complete:true,gaps:[]},items:Array.from({length:count},(_,i)=>({source_id:'synthetic-'+i,lane:'comment',author:'@reader'+(i+1),text:comments[i%8],url:'https://www.threads.com/example-comment-'+i,occurred_at:new Date(start.getTime()+i*1000).toISOString(),pending:true,available:true,safety:'safe',context_complete:true,ancestry:[],post:posts[i%8<6?0:1]}))};
  const status=store.import(snapshot);
  store.drafts({version:1,account:'@example',drafts:status.items.map((item,i)=>({id:item.id,revision:item.revision,source_id:item.source_id,text:replies[Number(item.source_id.split('-')[1])%8],mode:i%3?'native':'agent',context_verified:true,gates_passed:true}))});
  return store;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { demo(process.argv[2]); console.log('Synthetic demo ready for @example. Use serve with the same --root directory.'); }
