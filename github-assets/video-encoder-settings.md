Encoder settings for token raise hand and xcard in `assets/toolclips/tools/`

```sh
ffmpeg -i .\token-xcard.mp4 -vf "fps=60,scale=344:344:flags=lanczos,format=yuv420p" -c:v libvpx-vp9 -color_range pc -colorspace bt709 -color_primaries bt709 -color_trc
iec61966-2-1 -b:v 0 -crf 29 -g 150 -quality best -speed 0 -auto-alt-ref 1 -lag-in-frames 25 -static-thresh 80 -an token-xcard.webm
```