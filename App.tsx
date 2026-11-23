import React,{useEffect,useState,useRef} from 'react';
import {useWindowDimensions,ActivityIndicator,Alert,Image,Platform,Pressable,SafeAreaView,ScrollView,StatusBar,StyleSheet,Text,TextInput,View} from 'react-native';
import Svg,{Defs,Pattern,Rect,Path} from 'react-native-svg';
import * as Picker from 'expo-image-picker';
import * as Manipulator from 'expo-image-manipulator';
import {BoxArt} from './src/BoxArt';
import {boxTags,colors,demoData,emptyData,id,saveBox,deleteBox,saveItem,deleteItem,confirmSession,saveDraft,validateEndpoint,unusedImages,referencedImages,search,type Data,type Box,type Item,type Session} from './src/model';
import {load,persist} from './src/storage';
import {defaultCutoutService, makeSticker, makeStickers, type SubjectPoint} from './src/cutout';
import {StickyNote} from './src/StickyNote';
import {Sticker} from './src/Sticker';
import { removePhotos, portablePhotos, localizePhotos } from './src/photos';
import { encodeBackup, decodeBackup } from './src/backup';
import { exportFile, importFile } from './src/backupFiles';
const C={bg:'#171512',card:'#29231E',muted:'#B9AA99',text:'#F5EEE4',accent:'#E9C99D'};
const glyphs={trash:'M3 6h18 M8 6V3h8v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',camera:'M3 7h4l2-3h6l2 3h4v13H3z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',album:'M3 4h18v16H3z M4 18l6-7 4 4 3-3 4 4',shirt:'M8 3l-6 3 2 5 3-1v11h10V10l3 1 2-5-6-3c-1 4-7 4-8 0z',edit:'M4 16L16 4l4 4L8 20l-5 1z',home:'M3 5h18v5H3z M5 10v10h14V10 M9 14h6',search:'M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',settings:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2',history:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 5v7l5 3',out:'M12 3v12m-5-5 5 5 5-5 M3 15v6h18v-6',into:'M12 16V3m-5 5 5-5 5 5 M3 15v6h18v-6'};
function Icon({name,color=C.accent}:{name:keyof typeof glyphs;color?:string}){return <Svg width={24} height={24} viewBox="0 0 24 24"><Path d={glyphs[name]} stroke={color} fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></Svg>}
function ItemThumb({item}:{item:Item}){
 return <View style={s.thumb}>{item.image?<Image source={{uri:item.image}} resizeMode="contain" style={{width:'100%',height:'100%'}}/>:<Icon name={item.category==='衣物'?'shirt':'home'}/>}</View>
}
function Brand(){return <View style={s.brand}>
 <View style={s.mark}>{Array.from({length:8},(_,i)=><View key={i} style={[s.stripe,{left:i*8-15}]}/>)}</View>
 <View><Text accessibilityLabel="Boxin收纳盒" style={s.wordmark}>Boxin<Text style={{fontWeight:'400',color:C.accent}}>收纳盒</Text></Text><Text style={s.small}>让每件小物，有处可寻</Text></View>
 </View>}
function ProfileRow({icon,title,detail,onPress}:{icon:keyof typeof glyphs;title:string;detail:string;onPress:()=>void}){return <Pressable accessibilityRole="button" onPress={onPress} style={{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:10}}><Icon name={icon}/><View style={{flex:1}}><Text style={s.subtitle}>{title}</Text><Text style={s.small}>{detail}</Text></View></Pressable>}
function Button({title,onPress,quiet=false}:{title:string;onPress:()=>void;quiet?:boolean}){return <Pressable accessibilityRole="button" onPress={onPress} style={[s.button,quiet&&s.quiet]}><Text style={{color:quiet?C.text:C.bg,fontWeight:'600'}}>{title}</Text></Pressable>}
function Field({label,value,onChange,multiline=false}:{label:string;value:string;onChange:(v:string)=>void;multiline?:boolean}){return <View style={{gap:8,marginBottom:16}}><Text style={s.small}>{label}</Text><TextInput accessibilityLabel={label} maxLength={multiline?2000:120} value={value} onChangeText={onChange} multiline={multiline} placeholderTextColor={C.muted} style={[s.input,multiline&&{minHeight:80}]}/></View>}
export default function App(){
 const [data,setData]=useState<Data>(emptyData),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[toast,setToast]=useState('');
 const [page,setPage]=useState('home'),[boxId,setBoxId]=useState(''),[boxForm,setBoxForm]=useState<Box>(),[itemForm,setItemForm]=useState<Item>(),[query,setQuery]=useState(''),[highlight,setHighlight]=useState('');
 const [session,setSession]=useState<Session>(),[image,setImage]=useState<{uri:string;width:number;height:number}>(),[endpoint,setEndpoint]=useState('');
 const [incoming,setIncoming]=useState<Data>();
 const [batch,setBatch]=useState<Item[]>([]);
 const [boxMenu,setBoxMenu]=useState(false);
 const pending=batch.filter(row=>!data.items.some(item=>item.id===row.id));
 const [recognitionError,setRecognitionError]=useState('');
 const [recognizing,setRecognizing]=useState(false);
 const [point,setPoint]=useState<SubjectPoint>();
 const [preview,setPreview]=useState('');
 useEffect(()=>{
   let active=true;
   setPreview('');
   setRecognitionError('');
   setRecognizing(!!image && page==='itemForm');
   if(image && page==='itemForm'){
     makeSticker(image.uri,data.settings?.cutoutEndpoint||defaultCutoutService(),point)
       .then(uri=>{if(active)setPreview(uri)})
       .catch(err=>{if(active)setRecognitionError(err.message||'无法提取轮廓，请换一张照片')})
       .finally(()=>{if(active)setRecognizing(false)});
   }
   return ()=>{active=false};
 },[image,point,page,data.settings?.cutoutEndpoint]);
 const [previewWidth,setPreviewWidth]=useState(0);
 const {width:screenWidth}=useWindowDimensions();
 const contentWidth=Math.min(screenWidth,620)-76;
 const noteShift=Math.min(86,16+Math.max(0,(contentWidth-370)/2))-26;
 const boxShift=Math.min(45,Math.max(7,(screenWidth-289)/2-6));
 const [historyOpen,setHistoryOpen]=useState(false),[adding,setAdding]=useState(false);
 const stickers=data.items.filter(i=>i.isSticker);
 const tab=page==='settings'?'settings':page==='search'?'search':'home';
 const locked=useRef(false);
 const box=data.boxes.find(b=>b.id===boxId);
 useEffect(()=>{load().then(d=>{setData(d);setEndpoint(d.settings?.cutoutEndpoint||'');setReady(true)}).catch(()=>setError('本地数据读取失败，请重新启动应用；原数据未覆盖。'));},[]);
 useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),3000);return()=>clearTimeout(t)}},[toast]);
 async function commit(next:Data,done?:()=>void){if(locked.current)return;locked.current=true;setBusy(true);try{await persist(next);setData(next);done?.();setToast('已保存到本地');try{await removePhotos(unusedImages(data,next))}catch{setError('记录已保存，但部分无引用照片未能清理。')}}catch(e){setError('保存失败，未丢弃当前编辑。请检查设备存储空间。')}finally{locked.current=false;setBusy(false)}}
 async function exportBackup(){if(locked.current)return;locked.current=true;setBusy(true);try{await exportFile(encodeBackup(await portablePhotos(data)));setToast('备份已交给文件保存面板')}catch(e){setError((e as Error).message)}finally{locked.current=false;setBusy(false)}}
 async function selectBackup(){setIncoming(undefined);try{const content=await importFile();if(content!==undefined)setIncoming(decodeBackup(content))}catch(e){setError((e as Error).message)}}
 async function restoreBackup(){if(!incoming||locked.current)return;locked.current=true;setBusy(true);let localized:Data|undefined;let saved=false;try{localized=await localizePhotos(incoming);const next=localized;await persist(next);saved=true;setData(next);setIncoming(undefined);setToast('备份已恢复');await removePhotos(unusedImages(data,next)).catch(()=>setError('恢复成功，部分旧照片未能清理'))}catch(e){if(localized&&!saved)await removePhotos(referencedImages(localized)).catch(()=>{});setError('导入失败，原有记录未变更：'+(e as Error).message)}finally{locked.current=false;setBusy(false)}}
 function resumeDraft(draft:Session){setSession(draft);setBoxId(draft.boxId);setPage('review')}
 function attempt(fn:()=>void){try{fn()}catch(e){setError((e as Error).message)}}
 function confirm(title:string,fn:()=>void){if(Platform.OS==='web'){if(window.confirm(title))fn()}else Alert.alert('确认操作',title,[{text:'取消',style:'cancel'},{text:'确认',onPress:fn}])}
 function openBox(b:Box){setHomeTag(undefined);setBoxId(b.id);setHighlight('');setPage('detail')}
 function newBox(){setBoxForm({id:id(),name:'',color:colors[0],tag:homeTag||boxTags[0],note:'',location:'',updatedAt:''});setPage('boxForm')}
 function addItem(targetBox=boxId){setImage(undefined);setPoint(undefined);setItemForm({id:id(),boxId:targetBox||data.boxes[0]?.id||'',name:'',category:'其他'});setPage('itemForm')}
 async function choosePhoto(camera:boolean){
  const permission=camera?await Picker.requestCameraPermissionsAsync():await Picker.requestMediaLibraryPermissionsAsync();if(!permission.granted)throw new Error('请在系统设置中允许相机或相册访问，也可以手动添加物品。');
  const result=await(camera?Picker.launchCameraAsync({quality:1}):Picker.launchImageLibraryAsync({mediaTypes:['images'],quality:1}));if(result.canceled)return;
  if((result.assets[0].fileSize||0)>20*1024*1024)throw new Error('照片超过 20MB，请选择较小的图片');
  return result.assets[0];
 }
 async function pick(camera:boolean){
  try {
   const photo=await choosePhoto(camera);
   if(photo){if(!photo.width||!photo.height)throw new Error('无法读取图片尺寸，请选择其他照片');const resize=photo.width>=photo.height?{width:Math.min(1400,photo.width)}:{height:Math.min(1400,photo.height)};
     const source=Platform.OS==='web'?photo:await Manipulator.manipulateAsync(photo.uri,[{resize}],{format:Manipulator.SaveFormat.PNG});
     setImage(source);setPoint(undefined);setPage('itemForm')}
  }catch(e){setError((e as Error).message)}
 }
 async function cutPhoto(multiple=false){
  if(!image||!itemForm||locked.current)return;
  locked.current=true;setBusy(true);
  try {
   const photo=image;
   const service=data.settings?.cutoutEndpoint||defaultCutoutService();
   if(multiple){
    const stickers=await makeStickers(photo.uri,service);
    setBatch(stickers.map((image,n)=>({id:id(),boxId:itemForm.boxId,name:'物品 '+(n+1),category:itemForm.category,isSticker:true,image})));
    setBoxId(itemForm.boxId);setBoxMenu(false);
    setPage('batch');
    return;
   }
   const sticker=preview||await makeSticker(photo.uri,service,point);
   setItemForm({...itemForm,image:sticker,isSticker:true,outline:undefined});
   setImage(undefined);setPoint(undefined);
  }catch(e){setError((e as Error).message)}
  finally{locked.current=false;setBusy(false)}
 }
 function storeStickers(rows:Item[],finish:boolean){
   if(!rows.length)return;
   attempt(()=>{
     const next=rows.reduce((state,row)=>saveItem(state,{...row,boxId}),data);
     commit(next,()=>{if(finish){setImage(undefined);setBatch([]);setPage('detail')}});
   });
 }
 const [homeTag,setHomeTag]=useState<Box['tag']>();
 const shown=homeTag?data.boxes.filter(b=>b.tag===homeTag):data.boxes;
 const results=search(data,query);
 const matchedBoxes=new Set(results.boxes.map(b=>b.id));
 const matchedItems=new Set(results.items.map(i=>i.id));
 const searchItems=data.items.filter(i=>matchedBoxes.has(i.boxId)||matchedItems.has(i.id));
 return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content"/><View style={s.shell}>
 <Brand/>
 {!ready?<View style={s.center}><ActivityIndicator color={C.accent}/><Text style={s.small}>{error||'正在打开你的收纳空间…'}</Text></View>:<>
 <ScrollView key={page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
 {!['home','search','settings'].includes(page)&&<Pressable onPress={()=>setPage(page==='batch'?'itemForm':page==='detail'?'home':box?'detail':'home')}><Text style={s.small}>‹ 返回</Text></Pressable>}
 {page==='home'&&<><View style={s.heading}><View><Text style={s.eyebrow}>YOUR LITTLE SPACE</Text><Text style={s.title}>我的收纳箱</Text></View><Button title="＋ 新建" onPress={newBox}/></View>
 <Pressable style={s.search} onPress={()=>setPage('search')}><Icon name="search"/><Text style={s.text}>找找你的物品、箱子或位置</Text></Pressable>
 <View style={s.row}>{boxTags.map(tag=><Button key={tag} title={tag} quiet={homeTag!==tag} onPress={()=>setHomeTag(homeTag===tag?undefined:tag)}/>)}</View>
 <Text style={s.small}>{data.boxes.length} 个箱子 · {data.items.length} 件被记住的小物</Text>
 {data.sessions.some(d=>d.status==='pending')&&<View style={s.panel}><Text style={s.subtitle}>还有小物等你确认</Text><Text style={s.small}>草稿已保存在本地，还没有加入正式收纳箱。</Text>{data.sessions.filter(d=>d.status==='pending').map(d=><Button key={d.id} quiet title={'继续确认 · '+data.boxes.find(b=>b.id===d.boxId)?.name+' · '+d.items.length+' 件'} onPress={()=>resumeDraft(d)}/>)}</View>}
 <View style={s.grid}>{shown.map(b=><Pressable key={b.id} onPress={()=>openBox(b)} style={s.boxCard}><BoxArt color={b.color} size={Math.min(150,(screenWidth-110)/2)}/><Text style={s.cardTitle}>{b.name}</Text><Text numberOfLines={1} style={s.cardNote}>{b.location||'还没写位置'}</Text><Text style={s.cardNote}>{data.items.filter(i=>i.boxId===b.id).length} 件物品　↗</Text></Pressable>)}</View>
 {homeTag&&!shown.length&&<Button quiet title="此分类暂无箱子 · 查看全部" onPress={()=>setHomeTag(undefined)}/>}
 {!data.boxes.length&&!homeTag&&<View style={s.center}><BoxArt color={colors[0]}/><Text style={s.subtitle}>给生活里的小物安个家</Text><Text style={s.small}>创建第一个箱子，记住它的颜色和位置。</Text><Button title="创建收纳箱" onPress={newBox}/></View>}
 <View style={s.tip}><Text style={{color:C.accent}}>收纳，不只是把东西放好。</Text><Text style={s.small}>也是在需要时，轻松找到它。</Text></View></>}
 {page==='boxForm'&&boxForm&&<><Text style={s.title}>给箱子一个名字</Text><View style={{alignItems:'center'}}><BoxArt color={boxForm.color}/></View><Field label="箱子名称 *" value={boxForm.name} onChange={name=>setBoxForm({...boxForm,name})}/>{!data.boxes.some(b=>b.id===boxForm.id)&&<><Text style={s.small}>收纳分类</Text><View style={s.row}>{boxTags.map(tag=><Button key={tag} title={tag} quiet={boxForm.tag!==tag} onPress={()=>setBoxForm({...boxForm,tag})}/>)}</View></>}<Text style={s.small}>选一个喜欢的颜色</Text><View style={s.row}>{colors.map(c=><Pressable key={c} accessibilityLabel={'箱子颜色 '+c} onPress={()=>setBoxForm({...boxForm,color:c})} style={[s.swatch,{backgroundColor:c,borderWidth:boxForm.color===c?3:0}]}/>)}</View><Text style={s.small}>箱子备注</Text><StickyNote value={boxForm.note} onChange={note=>setBoxForm({...boxForm,note})}/><Field label="它放在哪里？" value={boxForm.location} onChange={location=>setBoxForm({...boxForm,location})}/><Button title="保存并添加物品" onPress={()=>attempt(()=>commit(saveBox(data,boxForm),()=>{openBox(boxForm);setAdding(true)}))}/><Button title="保存收纳箱" onPress={()=>attempt(()=>commit(saveBox(data,boxForm),()=>openBox(boxForm)))}/></>}
 {page==='detail'&&box&&<><View style={s.heading}><Text style={s.title}>{box.name}</Text><Button title="编辑" quiet onPress={()=>{setBoxForm(box);setPage('boxForm')}}/></View><View style={s.hero}><View style={s.boxScene}>
 <View testID="detail-box-art" style={{transform:[{translateX:-boxShift}]}}><BoxArt color={box.color} size={289}/></View>
 <View testID="detail-box-note" style={[s.detailNote,{transform:[{translateX:noteShift}]}]}><StickyNote value={box.note} compact/></View>
 </View></View><Text style={s.small}>⌖ {box.location||'尚未设置存放位置'}</Text><View style={s.heading}><Text style={s.subtitle}>箱内的小物 · {data.items.filter(i=>i.boxId===box.id).length}</Text><Button title="＋ 添加" onPress={()=>setAdding(true)}/></View><View style={s.grid}>{data.items.filter(i=>i.boxId===box.id).map(i=><Pressable key={i.id} style={[s.itemCard,highlight===i.id&&{borderColor:C.accent,borderWidth:2}]} onPress={()=>{setImage(undefined);setPoint(undefined);setItemForm(i);setPage('itemForm')}}><ItemThumb item={i}/><Text style={s.text}>{i.name}</Text><Text style={s.small}>{i.category}</Text></Pressable>)}</View>{!data.items.some(i=>i.boxId===box.id)&&<Text style={s.small}>箱子还是空的。拍张照片，或手动记下第一件物品。</Text>}<Text style={s.small}>最近整理：{new Date(box.updatedAt).toLocaleDateString()}</Text><Button title="删除这个箱子" quiet onPress={()=>confirm('删除箱子及其全部物品和识别记录？',()=>commit(deleteBox(data,box.id),()=>setPage('home')))}/></>}
 {page==='review'&&session&&<><Text style={s.title}>确认一下这些小物</Text><Text style={s.small}>初始结果已存为草稿。编辑后请保存草稿，或直接确认入箱。</Text><Button title="保存草稿" quiet onPress={()=>attempt(()=>commit(saveDraft(data,session)))}/><Text style={s.small}>{session.mode==='mock'?'MOCK · 演示数据':session.mode==='vision'?'AI 识别 · 请逐项核对':'来源未标记 · 请核对'} · {session.items.length} 件</Text>{session.receipt&&<Text selectable style={s.small}>{session.receipt}</Text>}{session.image&&<Image source={{uri:session.image}} style={[s.photo,{height:160}]}/>}<Text style={s.small}>请对照原图核对物品和轮廓。</Text><View style={s.row}><Button title="全选" quiet onPress={()=>setSession({...session,items:session.items.map(i=>({...i,selected:true}))})}/><Button title="取消全选" quiet onPress={()=>setSession({...session,items:session.items.map(i=>({...i,selected:false}))})}/></View>{session.items.map((d,n)=><View style={s.panel} key={d.id}>{d.outline&&session.image&&<Sticker uri={session.image} outline={d.outline}/>}<View style={s.heading}><Button title={d.selected?'✓ 已选择':'○ 未选择'} quiet onPress={()=>setSession({...session,items:session.items.map(i=>i.id===d.id?{...i,selected:!i.selected}:i)})}/><Button title="移除" quiet onPress={()=>setSession({...session,items:session.items.filter(i=>i.id!==d.id)})}/></View><Field label={'物品 '+(n+1)+' 名称'} value={d.name} onChange={name=>setSession({...session,items:session.items.map(i=>i.id===d.id?{...i,name}:i)})}/><Field label="分类" value={d.category} onChange={category=>setSession({...session,items:session.items.map(i=>i.id===d.id?{...i,category}:i)})}/><Text style={s.small}>置信度：{d.confidence===undefined?'未提供':Math.round(d.confidence*100)+'%'} · 请确认名称</Text></View>)}<Button title="＋ 补充漏掉的物品" quiet onPress={()=>setSession({...session,items:[...session.items,{id:id(),name:'',category:'其他',selected:true}]})}/><Text style={s.subtitle}>放进哪个箱子？</Text>{data.boxes.map(b=><Button key={b.id} title={(session.boxId===b.id?'✓ ':'')+b.name} quiet={session.boxId!==b.id} onPress={()=>setSession({...session,boxId:b.id})}/>)}{!data.boxes.length&&<Text style={s.small}>请先返回首页创建一个收纳箱。</Text>}<Button title="确认并加入收纳箱" onPress={()=>attempt(()=>commit(confirmSession(data,session),()=>{setBoxId(session.boxId);setSession(undefined);setPage('detail')}))}/></>}
 {page==='batch'&&<>
 <View style={s.heading}><Text style={s.subtitle}>待保存贴纸 · {pending.length}</Text><Text style={s.small}>{batch.length-pending.length} 张已存入</Text></View>
 {batch.map((item,n)=>{
   const saved=data.items.some(row=>row.id===item.id);
   return <View key={item.id} style={s.stickerRow}>
     <View style={s.checker}><Svg width="100%" height="100%"><Defs><Pattern id="tiles" width="16" height="16" patternUnits="userSpaceOnUse"><Rect width="16" height="16" fill="#211c19"/><Path d="M0 0h8v8H0z M8 8h8v8H8z" fill="#39312b"/></Pattern></Defs><Rect width="100%" height="100%" fill="url(#tiles)"/></Svg><Image source={{uri:item.image}} resizeMode="contain" style={StyleSheet.absoluteFillObject}/></View>
     <View style={{flex:1,minWidth:0}}><TextInput accessibilityLabel={'贴纸 '+(n+1)+' 名称'} editable={!saved} style={[s.input,{padding:8}]} maxLength={120} value={item.name} onChangeText={name=>setBatch(rows=>rows.map(r=>r.id===item.id?{...r,name}:r))}/><Text style={s.small}>{saved?'已存入':'待保存'}</Text></View>
     {!saved&&<><Pressable accessibilityLabel={'保存贴纸 '+(n+1)} style={s.iconButton} onPress={()=>storeStickers([item],false)}><Icon name="out"/></Pressable><Pressable accessibilityLabel={'移除贴纸 '+(n+1)} style={s.iconButton} onPress={()=>setBatch(rows=>rows.filter(r=>r.id!==item.id))}><Icon name="trash"/></Pressable></>}
   </View>
 })}
 <Text style={s.small}>存入哪个箱子</Text><Pressable style={[s.panel,s.heading]} accessibilityLabel="选择目标箱子" onPress={()=>setBoxMenu(!boxMenu)}><Text style={s.text}>{box?.name}</Text><Text style={s.text}>⌄</Text></Pressable>
 {boxMenu&&data.boxes.map(b=><Button key={b.id} quiet title={b.name} onPress={()=>{setBoxId(b.id);setBoxMenu(false)}}/>)}
 <Button title={pending.length?'存入箱子（'+pending.length+' 件）':'完成'} onPress={()=>pending.length?storeStickers(pending,true):(setImage(undefined),setPage('detail'))}/>
 </>}
 {page==='workshop'&&<><Text style={s.title}>贴纸工坊</Text><Text style={s.small}>从照片中取出一件物品，做成自己的收纳贴纸。{Platform.OS==='web'?'u2netp 在本机浏览器运行，照片不会上传。':'选图后，照片会交给你配置的抠图服务处理。'}</Text><View style={s.panel}><Text style={s.small}>选图后可点原图切换主体，或一次切出多件。名称由你手动输入。</Text></View><View style={s.heading}>{[true,false].map(camera=><Pressable key={String(camera)} style={[s.photoAction,{backgroundColor:camera?C.accent:C.card}]} onPress={()=>pick(camera)}><Icon name={camera?'camera':'album'} color={camera?C.bg:C.text}/><Text style={[s.subtitle,{color:camera?C.bg:C.text}]}>{camera?'拍照':'从相册选择'}</Text></Pressable>)}</View>
 <Pressable style={s.panel} onPress={()=>{const asset=require('./server/studio/coffee.png');const uri=Platform.OS==='web'?'/sticker/coffee.png':Image.resolveAssetSource(asset).uri;Image.getSize(uri,(width,height)=>{setImage({uri,width,height});setPage('itemForm')},()=>setError('未能打开示例照片'))}}><Text style={s.subtitle}>试试示例：咖啡杯</Text><Text style={s.small}>木桌上的咖啡杯、碟和勺子</Text></Pressable><View style={s.panel}><Text style={s.subtitle}>拍得更好抠的几个小习惯</Text><View style={s.row}>{['物品之间留点空隙','背景越简洁越好','光线充足、主体清晰','点原图切换主体'].map(t=><Text key={t} style={[s.small,s.chip]}>{t}</Text>)}</View></View>{Platform.OS!=='web'&&<><Field label="抠图服务地址" value={endpoint} onChange={setEndpoint}/><Button title="保存地址" onPress={()=>attempt(()=>commit({...data,settings:{endpoint:data.settings?.endpoint||'',cutoutEndpoint:validateEndpoint(endpoint)}}))}/></>}</>}
 {page==='itemForm'&&itemForm&&<>{!image&&<><Text style={s.title}>物品的小档案</Text>{itemForm.isSticker&&itemForm.image?<Image source={{uri:itemForm.image}} style={s.photo}/>:itemForm.image&&itemForm.outline&&<Sticker uri={itemForm.image} outline={itemForm.outline}/>}
 {!image&&!data.items.some(i=>i.id===itemForm.id)&&<Text style={s.small}>一张照片可以收录多件物品。拍照时让物品之间留一点空隙。</Text>}
 <View style={s.row}><Button title="拍照" onPress={()=>pick(true)}/><Button quiet title="从相册选择" onPress={()=>pick(false)}/></View></>}
 {image&&recognizing&&<View style={[s.panel,s.row]}><ActivityIndicator color={C.accent}/><Text accessibilityLiveRegion="polite" style={s.text}>正在载入模型并提取物品轮廓…</Text></View>}
 {image&&!!recognitionError&&<View style={s.panel}><Text style={s.text}>{recognitionError}</Text><Button quiet title="换一张" onPress={()=>pick(false)}/><Button quiet title="取消选图" onPress={()=>setImage(undefined)}/></View>}
 {image&&!!preview&&!recognizing&&<><View style={s.panel}><View style={s.heading}><Text style={s.small}>原始照片</Text><Button quiet title="换一张" onPress={()=>pick(false)}/></View><View onLayout={e=>setPreviewWidth(e.nativeEvent.layout.width)}>
 {previewWidth>0&&<Pressable accessibilityLabel="点选照片中的物品" onPress={e=>{const h=Math.min(300,previewWidth*image.height/image.width);const w=h*image.width/image.height;setPoint({x:Math.min(1,Math.max(0,e.nativeEvent.locationX/w)),y:Math.min(1,Math.max(0,e.nativeEvent.locationY/h))})}} style={{alignSelf:'center',height:Math.min(300,previewWidth*image.height/image.width),aspectRatio:image.width/image.height}}>
 <View pointerEvents="none" style={StyleSheet.absoluteFill}><Image source={{uri:image.uri}} style={{width:'100%',height:'100%'}}/></View>{point&&<View pointerEvents="none" style={{position:'absolute',left:`${point.x*100}%`,top:`${point.y*100}%`,width:16,height:16,marginLeft:-8,marginTop:-8,borderRadius:8,borderWidth:3,borderColor:'white',backgroundColor:C.accent}}/>}</Pressable>}</View>
 <View style={[s.heading,{flexWrap:'wrap'}]}><Text style={s.small}>点图中的物品可切换主体。</Text>{!data.items.some(i=>i.id===itemForm.id)&&<Button quiet title="一键切出全部" onPress={()=>cutPhoto(true)}/>}</View></View><View style={s.panel}>
 <Image accessibilityLabel="贴纸预览" source={{uri:preview}} resizeMode="contain" style={{height:Math.min(screenWidth*.72,320)}}/><Button title="生成贴纸" onPress={()=>cutPhoto()}/><Button title="取消选图" quiet onPress={()=>setImage(undefined)}/></View></>}
 {image&&recognizing&&<View style={s.panel}><Text style={s.subtitle}>拍得更好抠的几个小习惯</Text><Text style={s.small}>物品之间留点空隙，背景越简洁越好。</Text></View>}
 {!image&&<> <Field label="物品名称 *" value={itemForm.name} onChange={name=>setItemForm({...itemForm,name})}/><Field label="分类" value={itemForm.category} onChange={category=>setItemForm({...itemForm,category})}/><Text style={s.subtitle}>所属箱子 / 移动到</Text>{data.boxes.map(b=><Button key={b.id} title={(itemForm.boxId===b.id?'✓ ':'')+b.name} quiet={itemForm.boxId!==b.id} onPress={()=>setItemForm({...itemForm,boxId:b.id})}/>)}{!itemForm.isSticker&&itemForm.image&&<><Text style={s.small}>原始识别照片</Text><Image source={{uri:itemForm.image}} style={s.photo}/></>}<Button title="保存物品" onPress={()=>attempt(()=>{if(image)throw new Error('请先生成贴纸或取消选图');return commit(saveItem(data,itemForm),()=>{setBoxId(itemForm.boxId);setPage('detail')})})}/>{data.items.some(i=>i.id===itemForm.id)&&<Button title="删除物品" quiet onPress={()=>confirm('删除这件物品的记录？',()=>commit(deleteItem(data,itemForm),()=>setPage('detail')))}/>}</>}</>}
 {page==='search'&&<><Text style={s.title}>你在找什么？</Text><Text style={s.small}>搜索物品、分类、箱子、便利贴或位置</Text><View style={s.search}><Icon name="search"/><TextInput accessibilityLabel="搜索" placeholder="找找你的物品、箱子或位置" placeholderTextColor={C.muted} style={[s.text,{flex:1,minWidth:0}]} value={query} onChangeText={setQuery}/>{!!query&&<Pressable accessibilityLabel="清除搜索" onPress={()=>setQuery('')}><Text style={s.subtitle}>×</Text></Pressable>}</View>
 {!query.trim()&&<><Text style={s.small}>忘了东西放哪了？输入物品名，比如：</Text><View style={s.row}>{['SD 卡','剪刀','围巾','药品'].map(q=><Pressable key={q} style={s.chip} onPress={()=>setQuery(q)}><Text style={s.text}>{q}</Text></Pressable>)}</View></>}
 {!!results.boxes.length&&<><Text style={s.subtitle}>收纳箱 · {results.boxes.length}</Text>{results.boxes.map(b=><Pressable key={b.id} accessibilityRole="button" style={s.result} onPress={()=>openBox(b)}>
 <View style={[s.dot,{backgroundColor:b.color}]}/><View style={{flex:1,gap:6}}><Text style={s.cardTitle}>{b.name}</Text>{!!b.location&&<Text style={s.cardNote}>位置 · {b.location}</Text>}{!!b.note&&<Text style={s.cardNote}>便利贴 · {b.note}</Text>}</View><Text>↗</Text></Pressable>)}</>}
 {!!searchItems.length&&<><Text style={s.subtitle}>小物 · {searchItems.length}</Text>{searchItems.map(i=>{const b=data.boxes.find(b=>b.id===i.boxId)!;return <Pressable key={i.id} accessibilityRole="button" style={[s.result,{backgroundColor:C.card}]} onPress={()=>{setBoxId(b.id);setHighlight(i.id);setImage(undefined);setPoint(undefined);setItemForm(i);setPage('itemForm')}}>
 <ItemThumb item={i}/><View style={{flex:1,gap:4}}><Text style={s.subtitle}>{i.name}</Text><Text style={s.text}>● {b.name}</Text><Text style={s.small}>⌖ {b.location||'位置未填写'}</Text></View></Pressable>})}</>}
 {!!query.trim()&&!results.items.length&&!results.boxes.length&&<><Text style={s.small}>没有找到相关箱子或物品，试试其他关键词。</Text><Button title={data.boxes.length?'手动添加物品':'新建箱子'} onPress={data.boxes.length?addItem:newBox}/></>}</>}
 {page==='settings'&&<><Text style={s.title}>我的</Text><View style={s.stats}><BoxArt color="#DEB972" size={72}/>{[[data.boxes.length,'个收纳箱'],[data.items.length,'件被记住的小物']].map(([n,label])=><View key={label} style={{flex:1}}><Text style={s.count}>{n}</Text><Text style={s.cardNote}>{label}</Text></View>)}</View>
 <Text style={s.small}>记录</Text><View style={s.panel}><ProfileRow icon="history" title="工坊记录" detail={stickers.length+' 件已保存的贴纸物品 · '+data.sessions.length+' 条识别记录'} onPress={()=>setHistoryOpen(!historyOpen)}/></View>
 {historyOpen&&<>{stickers.slice().reverse().map(i=><Text key={i.id} style={s.text}>{i.name} · {data.boxes.find(b=>b.id===i.boxId)?.name}</Text>)} <Text style={s.subtitle}>识别记录 · {data.sessions.length}</Text>{data.sessions.slice().reverse().map(d=><View key={d.id} style={s.panel}><Text style={s.text}>{data.boxes.find(b=>b.id===d.boxId)?.name} · {d.status==='pending'?'待确认':d.status==='confirmed'?'已入箱':'失败'}</Text><Text style={s.small}>{d.mode==='mock'?'Mock 演示':d.mode==='vision'?'AI 识别':'早期记录 · 来源未标记'} · {d.items.length} 件{d.createdAt?' · '+new Date(d.createdAt).toLocaleDateString():''}</Text>{d.receipt&&<Text selectable style={s.small}>{d.receipt}</Text>}{d.status==='pending'&&<Button title="继续确认草稿" onPress={()=>resumeDraft(d)}/>}<Button title="移除这条识别记录" quiet onPress={()=>confirm('移除识别记录？已入箱物品不会删除；不再被引用的照片会清理。',()=>commit({...data,sessions:data.sessions.filter(s=>s.id!==d.id)}))}/></View>)}
</>}
 <Text style={s.small}>备份</Text><View style={s.panel}><ProfileRow icon="out" title="导出备份" detail="生成一个包含箱子、物品和照片的文件" onPress={exportBackup}/><View style={{height:1,backgroundColor:'#50453B'}}/><ProfileRow icon="into" title="导入备份" detail="从备份文件恢复，需要确认才会覆盖" onPress={selectBackup}/>{incoming&&<><Text style={s.text}>将导入 {incoming.boxes.length} 个箱子、{incoming.items.length} 件物品、{incoming.sessions.length} 条识别记录。</Text><Text style={s.small}>确认后将替换当前全部箱子、物品和照片。</Text><Button title="确认覆盖并恢复" onPress={restoreBackup}/><Button title="取消导入" quiet onPress={()=>setIncoming(undefined)}/></>}</View>
 <Text style={s.small}>数据</Text><View style={s.panel}><ProfileRow icon="history" title="恢复示例箱子" detail="替换为预置的示例箱子" onPress={()=>confirm('用示例替换当前全部箱子、物品和记录？',()=>commit({...demoData(),settings:data.settings}))}/><View style={s.divider}/><ProfileRow icon="home" title="清空所有数据" detail="删除全部箱子、物品和照片" onPress={()=>confirm('永久删除全部箱子、物品、照片和记录？',()=>commit(emptyData()))}/></View>
 <Text style={s.small}>隐私</Text><View style={s.panel}><Text style={s.subtitle}>数据保存在这台设备</Text><Text style={s.small}>Boxin收纳盒无需登录。箱子、物品和贴纸保存在本机。</Text></View>
 <Text style={s.small}>关于</Text><View style={s.panel}><Text style={s.subtitle}>ⓘ　Boxin收纳盒</Text><Text style={s.small}>拍一张照片，记住每个收纳箱里有什么；需要时，搜索物品就能找到它所在的箱子。</Text></View></>}
 </ScrollView><View style={s.nav}>{(['home','search','settings'] as const).map((p,i)=><Pressable accessibilityRole="tab" accessibilityLabel={['收纳箱','搜索','我的'][i]} aria-selected={tab===p} accessibilityState={{selected:tab===p}} key={p} onPress={()=>setPage(p)} style={[s.navItem,tab===p&&s.navActive]}><Icon name={p} color={tab===p?C.accent:C.text}/></Pressable>)}</View></>}
 {adding&&<View style={s.scrim}><Pressable accessibilityLabel="取消添加" style={StyleSheet.absoluteFill} onPress={()=>setAdding(false)}/><View style={s.sheet}><View style={s.handle}/><Text style={s.subtitle}>添加小物</Text>{[true,false].map(studio=><Pressable key={String(studio)} style={s.search} onPress={()=>{setAdding(false);addItem();if(studio)setPage('workshop')}}><Icon name={studio?'camera':'edit'}/><Text style={s.text}>{studio?'贴纸工坊（拍照 / 相册抠图）':'手动添加'}</Text></Pressable>)}</View></View>}
 {!!toast&&<View style={s.toast}><Text style={{color:C.bg}}>{toast}</Text></View>}
 {!!error&&<View style={s.error}><Text style={s.text}>{error}</Text><Button title="知道了" onPress={()=>setError('')}/></View>}
 {busy&&<View style={s.overlay}><ActivityIndicator size="large" color={C.accent}/><Text style={s.text}>正在处理，请稍候…</Text></View>}
 </View></SafeAreaView>
}
const s=StyleSheet.create({stripe:{position:'absolute',width:4,height:60,top:-11,backgroundColor:C.card,transform:[{rotate:'42deg'}]},mark:{width:36,height:36,borderRadius:9,overflow:'hidden',backgroundColor:C.accent},divider:{height:1,backgroundColor:'#50453B'},chip:{borderRadius:22,borderWidth:1,borderColor:'#50453B',paddingVertical:7,paddingHorizontal:12},thumb:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:'#342D26'},photoAction:{flex:1,aspectRatio:1.25,alignItems:'center',justifyContent:'center',borderRadius:20,gap:12},scrim:{...StyleSheet.absoluteFillObject,justifyContent:'flex-end',backgroundColor:'#0009'},sheet:{backgroundColor:C.card,padding:18,gap:12,borderTopLeftRadius:24,borderTopRightRadius:24},handle:{alignSelf:'center',backgroundColor:'#52463B',width:40,height:4,borderRadius:4},stickerRow:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:C.card,borderRadius:18,padding:10},checker:{width:54,height:54,overflow:'hidden',borderRadius:10},iconButton:{width:36,minHeight:44,alignItems:'center',justifyContent:'center'},safe:{flex:1,backgroundColor:C.bg},shell:{flex:1,width:'100%',maxWidth:620,alignSelf:'center'},brand:{marginHorizontal:16,paddingVertical:10,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:'#352D26',gap:12},wordmark:{color:C.text,fontSize:25,fontWeight:'700'},content:{padding:16,gap:20,paddingBottom:40},text:{color:C.text,fontSize:15},small:{color:C.muted,fontSize:13,lineHeight:21},eyebrow:{color:C.accent,fontWeight:'800',fontSize:11,letterSpacing:2,marginBottom:7},title:{color:C.text,fontSize:30,fontWeight:'900'},subtitle:{color:C.text,fontSize:18,fontWeight:'600'},heading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10},button:{backgroundColor:C.accent,paddingVertical:13,paddingHorizontal:13,borderRadius:30,alignItems:'center'},quiet:{backgroundColor:C.card,paddingVertical:9,paddingHorizontal:10},input:{backgroundColor:C.card,color:C.text,borderWidth:1,borderColor:'#4A3F35',padding:15,borderRadius:14,fontSize:16},search:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:C.card,padding:17,borderRadius:16},row:{flexDirection:'row',alignItems:'center',gap:10,flexWrap:'wrap'},swatch:{width:30,height:30,borderRadius:15,borderColor:C.text},grid:{flexDirection:'row',flexWrap:'wrap',gap:8},boxCard:{width:'48%',flexGrow:1,backgroundColor:'#E9DDC9',borderRadius:19,padding:14,alignItems:'center',gap:6},cardTitle:{color:'#29231E',fontSize:16,fontWeight:'700'},cardNote:{color:'#716453',fontSize:12,lineHeight:19},center:{alignItems:'center',justifyContent:'center',padding:24,gap:16},tip:{borderTopWidth:1,borderColor:'#4A3F35',paddingTop:25,gap:8,marginTop:16},hero:{alignItems:'center',backgroundColor:C.card,borderRadius:22,padding:16},boxScene:{width:'100%',maxWidth:370,alignItems:'center'},detailNote:{width:'65%',maxWidth:212,alignSelf:'flex-end',marginTop:-68},itemCard:{width:'31%',minWidth:0,backgroundColor:C.card,padding:13,borderRadius:16,gap:8},itemIcon:{fontSize:32,color:C.accent,textAlign:'center',padding:10},photo:{width:'100%',height:260,borderRadius:20,backgroundColor:C.card,resizeMode:'contain'},panel:{backgroundColor:C.card,padding:16,borderRadius:18,gap:12},result:{flexDirection:'row',gap:15,alignItems:'center',backgroundColor:'#E9DDC9',padding:20,borderRadius:18},dot:{width:28,height:36,borderRadius:6},stats:{backgroundColor:'#E9DDC9',borderRadius:24,flexDirection:'row',padding:18,gap:12,alignItems:'center'},count:{color:'#29231E',fontSize:30,fontWeight:'700'},nav:{alignSelf:'center',width:'70%',maxWidth:320,flexDirection:'row',padding:4,marginVertical:8,borderWidth:1,borderColor:'#51463A',borderRadius:40,backgroundColor:C.card},navItem:{flex:1,height:46,borderRadius:30,alignItems:'center',justifyContent:'center'},navActive:{backgroundColor:'#51463E'},toast:{position:'absolute',bottom:90,alignSelf:'center',backgroundColor:C.accent,padding:15,borderRadius:16},error:{position:'absolute',top:90,left:20,right:20,padding:22,backgroundColor:'#623D32',borderRadius:20,gap:15},overlay:{...StyleSheet.absoluteFillObject,backgroundColor:'#171512DD',alignItems:'center',justifyContent:'center',gap:20}});
