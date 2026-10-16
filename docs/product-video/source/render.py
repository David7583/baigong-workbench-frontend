"""Build a 60-second product film from verified UI captures and synthetic audio.

Inputs: assets, narration.json, evidence/capture.json and actual_run.json.
Outputs: H.264 MP4, subtitles, original music, contact sheet and QA report.
No network, product modification, model calls or personal-data access.
Usage: python source/render.py [--preview-only]
"""
from pathlib import Path
from functools import lru_cache
from bisect import bisect_right
import argparse, hashlib, json, math, os, shutil, subprocess, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT/'assets'
BUILD = ROOT/'.build/render'
BUILD.mkdir(parents=True, exist_ok=True)
W, H, FPS, DURATION, SR = 1920, 1080, 30, 60, 48000
FFMPEG = os.environ.get('FFMPEG') or shutil.which('ffmpeg')
FFPROBE = os.environ.get('FFPROBE') or shutil.which('ffprobe')
assert FFMPEG and FFPROBE, 'Install FFmpeg and FFprobe, or set FFMPEG / FFPROBE.'
INK, TEAL, MINT, GOLD = '#102c37', '#187c79', '#83d7c3', '#e4b96e'
WHITE, MUTED = '#f5f7f4', '#94aeb7'
FONT_PATH = os.environ.get('VIDEO_FONT')
if not FONT_PATH:
    FONT_PATH = next((str(p) for p in [Path('C:/Windows/Fonts/msyh.ttc'),Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')] if p.exists()), None)
assert FONT_PATH, 'Set VIDEO_FONT to a Chinese font (e.g. Noto Sans CJK).'
BOLD_PATH = os.environ.get('VIDEO_FONT_BOLD') or (str(Path('C:/Windows/Fonts/msyhbd.ttc')) if Path('C:/Windows/Fonts/msyhbd.ttc').exists() else FONT_PATH)

@lru_cache(80)
def font(size, bold=False): return ImageFont.truetype(BOLD_PATH if bold else FONT_PATH, size)
def txt(im, xy, text, size=30, color=WHITE, bold=False, anchor=None):
    ImageDraw.Draw(im).text(xy, text, font=font(size,bold), fill=color, anchor=anchor, stroke_width=0)
def ease(x): x=max(0,min(1,x)); return x*x*(3-2*x)
def rr(im, box, fill, radius=20, outline=None, width=1):
    ImageDraw.Draw(im).rounded_rectangle(tuple(map(int,box)),radius,fill,outline,width)
def line(im, pts, color, width=2): ImageDraw.Draw(im).line(pts,fill=color,width=width,joint='curve')
def circle(im,x,y,r,fill): ImageDraw.Draw(im).ellipse((x-r,y-r,x+r,y+r),fill=fill)

@lru_cache(20)
def asset(name): return Image.open(ASSETS/name).convert('RGB')
@lru_cache(120)
def scaled(name, crop, size):
    im=asset(name)
    if crop: im=im.crop(crop)
    return im.resize(size, Image.Resampling.LANCZOS)
def picture(im, name, box, crop=None, border=True):
    x,y,w,h=map(int,box)
    if border:
        rr(im,(x-8,y-8,x+w+8,y+h+8),'#25414a',14)
        rr(im,(x-2,y-2,x+w+2,y+h+2),'#8b9c9e',8)
    im.paste(scaled(name,crop,(w,h)),(x,y))

grid_y,grid_x=np.mgrid[0:H,0:W]
v=(.55*grid_x/W+.45*grid_y/H)[...,None]
BG=Image.fromarray(np.uint8(np.array([11,28,38])*(1-v)+np.array([24,57,65])*v))
def bg(t):
    im=BG.copy();d=ImageDraw.Draw(im)
    for x in range(0,W,96): d.line((x,0,x,H),fill=(28,53,63))
    for y in range(0,H,96): d.line((0,y,W,y),fill=(28,53,63))
    for i in range(10):
        x=(i*241+t*9)%W;y=120+(i*139)%750
        circle(im,x,y,2,'#3c6c73')
    return im

def badge(im, text, x=86, y=91, color=MINT):
    width=int(ImageDraw.Draw(im).textlength(text,font=font(20)))+32
    rr(im,(x,y,x+width,y+36),'#203f47',18)
    txt(im,(x+16,y+5),text,20,color)
def chrome(im, t, chapter, label):
    txt(im,(80,37),'百工  /  LOCAL AI WORKBENCH',22,WHITE,True)
    txt(im,(1840,40),f'{chapter}  /  {label}',21,MUTED,anchor='ra')
    line(im,[(80,78),(1840,78)],'#36545c',1)
    line(im,[(80,1046),(1840,1046)],'#35525b',2)
    line(im,[(80,1046),(80+1760*t/60,1046)],MINT,3)
    txt(im,(80,1052),'PRODUCT FILM  ·  2026',13,MUTED)
    txt(im,(1840,1052),f'{int(t):02d} / 60',13,MUTED,anchor='ra')

CAPTURE=json.loads((ROOT/'evidence/capture.json').read_text('utf-8'))
RUN=json.loads((ROOT/'evidence/actual_run.json').read_text('utf-8'))
assert RUN['status']=='completed' and len(RUN['steps'])==5
TIMES=[f['time'] for f in CAPTURE['frames']]
EVENTS={e['name']:e['time'] for e in CAPTURE['events']}
def recording(t):
    i=max(0,min(len(TIMES)-1,bisect_right(TIMES,t)-1))
    return 'capture/'+CAPTURE['frames'][i]['file']

def section_intro(t):
    im=bg(t);chrome(im,t,'01','一个工作环境')
    u=ease(t/1.4);shift=int(28*(1-u))
    picture(im,'baigong-logo.png',(90,173+shift,108,108),border=False)
    txt(im,(90,321+shift),'AI，不止于回答。',65,WHITE,True)
    txt(im,(94,427+shift),'Local AI',48,MINT,True)
    txt(im,(94,495+shift),'Workbench',48,MINT,True)
    txt(im,(96,605),'管理工具 · 连接资源 · 组织任务',26,'#c2d3d7')
    for i,s in enumerate(['本地工作环境','可扩展能力','明确授权']):
        badge(im,s,96+i*166,694)
    # True application capture, with a gentle camera push.
    p=min(1,t/10);x=int(755-20*p);y=int(220-10*p)
    picture(im,'home.png',(x,y,1090,613))
    badge(im,'真实软件界面 · 隔离空环境',x+24,y+635)
    return im

def section_concept(t):
    im=bg(t);chrome(im,t,'02','家庭历史资料')
    badge(im,'场景目标 · 概念动画（不是运行结果）',color=GOLD)
    txt(im,(88,168),'让分散的资料，成为可连接的记忆。',49,WHITE,True)
    txt(im,(90,251),'示例目标：文件读取 → 信息提取 → 按年份整理 → 时间线',27,'#b8cdd1')
    names=['读取文件','提取信息','按年份整理','生成时间线']
    subs=['照片 / 笔记 / 文档','事件 · 日期 · 来源','保留来源与待核实项','可追溯的记忆脉络']
    local=t-10
    for i in range(4):
        x=88+i*447;y=375+int(30*(1-ease((local-i*.28)/.7)))
        if i<3:
            line(im,[(x+360,y+90),(x+447,y+90)],'#43757b',3)
            q=(local*.45-i*.23)%1;circle(im,x+360+q*87,y+90,6,MINT)
        rr(im,(x,y,x+360,y+218),'#193b46',22,outline='#3a626b',width=2)
        txt(im,(x+25,y+24),f'0{i+1}',24,GOLD,True)
        txt(im,(x+25,y+78),names[i],37,WHITE,True)
        txt(im,(x+25,y+154),subs[i],22,MUTED)
    for i,(year,desc) in enumerate([('1988','第一张全家福'),('2003','搬入新家'),('2020','三代人的团聚')]):
        x=245+i*620;line(im,[(245,742),(1485,742)],'#365e66',3)
        circle(im,x,742,7,MINT);txt(im,(x,676),year,35,MINT,True,anchor='ma');txt(im,(x,776),desc,24,'#c4d5d9',anchor='ma')
    return im

def section_connect(t):
    im=bg(t);chrome(im,t,'02','能力编排 · 真实操作')
    badge(im,'实录 · 虚构家庭样本 · 无模型调用')
    txt(im,(1840,104),'端口连线，建立实际数据传递',25,'#d5e7e9',anchor='ra')
    # Re-time actual capture, retaining all observed connection changes.
    source=EVENTS['connected']*max(0,min(1,(t-16)/7.5))
    if t>=23.5:source=EVENTS['connected']+(EVENTS['validated']-EVENTS['connected'])*(t-23.5)/2.5
    picture(im,recording(source),(90,168,1740,814),crop=(140,135,1358,705))
    return im

def section_execution(t):
    im=bg(t);chrome(im,t,'02','执行与追溯')
    badge(im,'真实运行 · 5 个节点完成 · 人工构造样本')
    source=EVENTS['run']+(t-26)/4.4*(EVENTS['result']-EVENTS['run'])
    picture(im,recording(min(source,EVENTS['result'])),(88,174,1150,802),crop=(350,175,1355,875))
    x=1294
    txt(im,(x,197),'过程，有据可查。',36,WHITE,True)
    for i,s in enumerate(['01  结构与端口校验','02  按依赖执行节点','03  保留输入、输出与日志']):
        txt(im,(x,290+i*68),s,25,MINT if t>27+i*.6 else MUTED)
    rr(im,(x,548,1830,846),'#eff4ef',22)
    txt(im,(x+30,577),'实际输出摘录',22,TEAL,True)
    txt(im,(x+30,634),'1988 年',47,INK,True)
    txt(im,(x+30,705),'第一张全家福',34,INK,True)
    txt(im,(x+30,785),'来源：虚构家庭样本',21,'#556c70')
    return im

def section_permission(t):
    im=bg(t);chrome(im,t,'02','权限边界')
    badge(im,'真实界面 · AI 分析未启用')
    picture(im,'analysis.png',(88,177,1160,738),crop=(140,32,1355,805))
    picture(im,'permissions.png',(1310,177,470,738),crop=(1260,100,1600,634))
    return im

def section_architecture(t):
    im=bg(t);chrome(im,t,'03','可扩展的能力组织环境')
    badge(im,'架构示意 · 基于现有模块')
    txt(im,(90,169),'自由组合，受控执行。',50,WHITE,True)
    picture(im,'standards.png',(520,338,880,495))
    cards=[(90,360,'模块化工具','工具 / MCP / Agent'),(90,656,'本地资源','资料与能力引用'),(1460,360,'规范与权限','管理入口 · 显式授权'),(1460,656,'任务与追溯','执行状态 · 节点日志')]
    for i,(x,y,title,sub) in enumerate(cards):
        sx=x+340 if x<960 else x;ex=520 if x<960 else 1400
        line(im,[(sx,y+70),(ex,y+70)],'#507e85',3)
        q=((t-35)*.5+i*.21)%1;circle(im,sx+(ex-sx)*q,y+70,6,MINT)
        rr(im,(x,y,x+350,y+157),'#1a3e49',18,outline='#4a6f78',width=2)
        txt(im,(x+24,y+24),title,32,WHITE,True);txt(im,(x+24,y+91),sub,21,MUTED)
    txt(im,(960,274),'能力编排',34,MINT,True,anchor='ma')
    return im

def section_local(t):
    im=bg(t);chrome(im,t,'03','边界清晰，才能放心扩展')
    badge(im,'真实工具管理界面')
    picture(im,'tools.png',(90,200,1110,624))
    txt(im,(1275,231),'本地管理',47,MINT,True)
    txt(im,(1275,305),'不等于永不联网',35,WHITE,True)
    rr(im,(1270,421,1828,710),'#203e48',20,outline='#57737a',width=1)
    txt(im,(1300,455),'模型与工具',27,GOLD,True)
    txt(im,(1300,517),'按实际配置连接服务',27,WHITE)
    txt(im,(1300,578),'云端模型会接收请求数据',25,'#bfd3d7')
    txt(im,(1300,636),'调用仍受许可与规范约束',25,'#bfd3d7')
    return im

def section_end(t):
    im=bg(t);chrome(im,t,'04','从一个任务，延伸到更多工作方式')
    picture(im,'baigong-logo.png',(88,171,132,132),border=False)
    txt(im,(88,348),'Local AI',62,WHITE,True)
    txt(im,(88,426),'Workbench',62,WHITE,True)
    line(im,[(90,550),(530,550)],MINT,3)
    txt(im,(88,600),'让 AI 按规矩运行，',37,MINT,True)
    txt(im,(88,661),'让能力自由组合。',37,MINT,True)
    txt(im,(88,806),'百工 · 本地 AI 工作台',24,'#b5cdd2')
    picture(im,'home_final.png',(730,204,1110,624))
    txt(im,(738,862),'github.com/David7583/baigong-workbench-frontend',20,'#bbd3d6')
    return im

SCENES=[(0,section_intro),(10,section_concept),(16,section_connect),(26,section_execution),(31,section_permission),(35,section_architecture),(43.5,section_local),(50,section_end)]
CUES=json.loads((ROOT/'source/narration.json').read_text('utf-8'))

def wrap(text,width,size=30):
    d=ImageDraw.Draw(Image.new('RGB',(1,1)));lines=[];s=''
    for ch in text:
        if d.textlength(s+ch,font=font(size))>width:lines.append(s);s=ch
        else:s+=ch
    if s:lines.append(s)
    return lines

def frame(t, subtitles=True):
    idx=max(i for i,(s,_) in enumerate(SCENES) if t>=s)
    start,fn=SCENES[idx];im=fn(t)
    if idx and t-start<.38:
        prior=SCENES[idx-1][1](start-.001)
        im=Image.blend(prior,im,ease((t-start)/.38))
    if t<.5:im=Image.blend(Image.new('RGB',(W,H),'#0b1c26'),im,ease(t/.5))
    if subtitles:
        cue=next((c for c in CUES if c['start']<=t<c.get('speech_end',c['end'])),None)
        if cue:
            lines=wrap(cue['text'],1715,29)
            y=1009-len(lines)*40
            rr(im,(72,y-14,1848,1015),'#0c222d',12)
            for i,s in enumerate(lines):txt(im,(960,y+i*40),s,29,WHITE,anchor='ma')
    return im

def run(args,**kw):return subprocess.run([str(x) for x in args],check=True,**kw)
def probe(file):return json.loads(subprocess.check_output([FFPROBE,'-v','error','-show_format','-show_streams','-of','json',str(file)]))
def wav(file,samples):
    with wave.open(str(file),'wb') as f:
        f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes((np.clip(samples,-.99,.99)*32767).astype('<i2').tobytes())

def music():
    """Original deterministic ambient score: no samples or commercial recordings."""
    n=SR*DURATION;audio=np.zeros((n,2),np.float64)
    chords=[(130.813,155.563,195.998,293.665),(103.826,130.813,155.563,233.082),(155.563,195.998,233.082,349.228),(116.541,146.832,174.614,261.626)]
    rng=np.random.default_rng(20261016)
    for block in range(8):
        start=block*7.5;length=min(9,DURATION-start);tt=np.arange(int(length*SR))/SR
        env=np.minimum(tt/1.1,1)*np.minimum((length-tt)/1.8,1)
        for j,freq in enumerate(chords[block%4]):
            tone=(np.sin(2*np.pi*freq*tt)+.26*np.sin(2*np.pi*freq*2*tt)+.12*np.sin(2*np.pi*(freq+.32)*tt))*env*.012
            offset=int(start*SR);audio[offset:offset+len(tt),0]+=tone*(.8+j*.04);audio[offset:offset+len(tt),1]+=tone*(1-j*.04)
    for beat in np.arange(.5,59,60/84/2):
        tt=np.arange(int(.6*SR))/SR;freq=chords[int(beat/7.5)%4][int(beat*2)%4]*4
        env=(1-np.exp(-tt*90))*np.exp(-tt*9)
        pluck=np.sin(2*np.pi*freq*tt)*env*.023
        pos=int(beat*SR);end=min(n,pos+len(tt));pan=.25+.5*rng.random()
        audio[pos:end,0]+=pluck[:end-pos]*pan;audio[pos:end,1]+=pluck[:end-pos]*(1-pan)
    tt=np.arange(n)/SR;fade=np.minimum(tt/2,1)*np.minimum((60-tt)/3,1);audio*=fade[:,None]
    wav(ASSETS/'original_ambient.wav',audio)
    return audio

def audio_mix():
    bed=music();speech=np.zeros_like(bed);report=[]
    for i,cue in enumerate(CUES):
        source=ASSETS/f'voice_{i:02}.mp3';duration=float(probe(source)['format']['duration'])
        slot=cue['end']-cue['start'];tempo=max(1,duration/(slot-.15))
        target=BUILD/f'voice_{i:02}.wav'
        run([FFMPEG,'-v','error','-y','-i',source,'-af',f'atempo={tempo:.7f},loudnorm=I=-16:TP=-2:LRA=7','-ar',SR,'-ac',2,'-c:a','pcm_s16le',target])
        with wave.open(str(target),'rb') as f:arr=np.frombuffer(f.readframes(f.getnframes()),'<i2').astype(np.float64).reshape(-1,2)/32768
        start=round(cue['start']*SR);speech[start:start+len(arr)]+=arr
        cue['speech_end']=cue['start']+len(arr)/SR
        assert cue['speech_end']<=cue['end']+.06
        a=max(0,start-int(.18*SR));b=min(len(bed),start+len(arr)+int(.18*SR));bed[a:b]*=.63
        report.append({'cue':i,'source_seconds':duration,'tempo':tempo,'start':cue['start'],'end':cue['speech_end'],'slot_end':cue['end']})
    wav(BUILD/'mix_raw.wav',speech+bed)
    run([FFMPEG,'-v','error','-y','-i',BUILD/'mix_raw.wav','-af','loudnorm=I=-16:TP=-1.5:LRA=7','-ar',SR,'-ac',2,BUILD/'mix.wav'])
    (ROOT/'evidence/audio_timing.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    def stamp(t):
        ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
    srt='\n\n'.join(f'{i+1}\n{stamp(c["start"])} --> {stamp(c["speech_end"])}\n'+ '\n'.join(wrap(c['text'],1715,29)) for i,c in enumerate(CUES))+'\n'
    (ROOT/'Local_AI_Workbench_zh.srt').write_text(srt,encoding='utf-8')

def previews():
    times=[3,12,20,28.5,33,39,46,55]
    sheet=Image.new('RGB',(1280,4*392),'#102c37')
    for i,t in enumerate(times):
        im=frame(t);im.save(BUILD/f'preview_{t}.png')
        thumb=im.resize((640,360),Image.Resampling.LANCZOS);x=(i%2)*640;y=(i//2)*392
        sheet.paste(thumb,(x,y));txt(sheet,(x+12,y+364),f'{t:04.1f} s',20,WHITE)
    sheet.save(ROOT/'evidence/contact_sheet.jpg',quality=92)
    frame(3,False).save(ROOT/'poster.jpg',quality=95)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--preview-only',action='store_true');args=parser.parse_args()
    audio_mix();previews()
    if args.preview_only:print('Preview and audio prepared',flush=True);return
    output=ROOT/'Local_AI_Workbench_60s.mp4'
    log=open(ROOT/'evidence/encode.log','w',encoding='utf-8')
    cmd=[FFMPEG,'-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-i',str(BUILD/'mix.wav'),'-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar',str(SR),'-t','60','-movflags','+faststart','-metadata','title=Local AI Workbench | Product Film','-metadata','comment=Real UI footage; synthetic family sample; concept segment explicitly labeled.',str(output)]
    proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log,stdout=subprocess.DEVNULL)
    try:
        for i in range(FPS*DURATION):
            proc.stdin.write(frame(i/FPS).tobytes())
            if i%150==0:print(f'Rendering {i//FPS:02d}/60 seconds',flush=True)
    finally:proc.stdin.close()
    assert proc.wait()==0,'FFmpeg encode failed';log.close()
    info=probe(output);video=next(s for s in info['streams'] if s['codec_type']=='video');audio=next(s for s in info['streams'] if s['codec_type']=='audio')
    assert video['width']==W and video['height']==H and video['codec_name']=='h264'
    assert video['r_frame_rate']=='30/1' and int(video['nb_frames'])==1800
    assert video['pix_fmt']=='yuv420p' and audio['codec_name']=='aac'
    assert abs(float(info['format']['duration'])-60)<.1
    assert abs(float(video['duration'])-float(audio['duration']))<.1
    decode=run([FFMPEG,'-v','error','-i',output,'-f','null','-'],capture_output=True)
    assert not decode.stderr,decode.stderr.decode(errors='replace')
    loudness=subprocess.run([FFMPEG,'-hide_banner','-i',output,'-af','loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
    (ROOT/'evidence/loudness.log').write_text(loudness.stderr,encoding='utf-8')
    qa={'status':'passed','width':W,'height':H,'fps':'30/1','frames':1800,'duration':info['format']['duration'],'video_codec':'h264','audio_codec':'aac','audio_sample_rate':audio['sample_rate'],'audio_video_duration_delta':abs(float(video['duration'])-float(audio['duration'])),'full_decode_errors':0,'all_narration_within_slots':True,'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'ffprobe':info}
    (ROOT/'evidence/validation.json').write_text(json.dumps(qa,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in qa.items() if k!='ffprobe'}),flush=True)

if __name__=='__main__':main()
