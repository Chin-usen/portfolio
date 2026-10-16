from PIL import Image, ImageDraw
from pathlib import Path
p=Path(__file__).parent
for lang in ['zh','en']:
 for width in [1440,390]:
  pages=['home','work','lab','about','contact']
  thumbw=480 if width==1440 else 390
  thumbs=[]
  for pg in pages:
   for theme in ['light','dark']:
    im=Image.open(p/f'b-{lang}-{pg}-{width}-{theme}.png').convert('RGB')
    im.thumbnail((thumbw, 1200))
    thumbs.append((pg,theme,im))
  heights=[max(thumbs[i][2].height,thumbs[i+1][2].height)+30 for i in range(0,10,2)]
  sheet=Image.new('RGB',(thumbw*2,sum(heights)),(220,220,220));d=ImageDraw.Draw(sheet);y=0
  for row in range(5):
   for col in range(2):
    pg,theme,im=thumbs[row*2+col];x=col*thumbw
    d.text((x+4,y+5),f'{lang} {pg} {width} {theme}',fill=(0,0,0));sheet.paste(im,(x,y+25))
   y+=heights[row]
  sheet.save(p/f'b-sheet-{lang}-{width}.png')
