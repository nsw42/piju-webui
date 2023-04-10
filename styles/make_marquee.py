from collections import namedtuple

INDENT = 4 * ' '
SLIDE_DURATION = 2
SHOW = 4

Keyframe = namedtuple('Keyframe', 'time, xpos, opacity')

# based on https://www.hongkiat.com/blog/css3-animation-advanced-marquee/


def write_keyframes(n, i, total_s, keyframes):
    print(f'@keyframes marquee-{n}elt-{i}')
    for (s, xpos, opacity) in keyframes:
        pct = int(round(100 * s / total_s))
        print(f'{INDENT}/* {s} */')
        print(f'{INDENT}{pct}%')
        print(f'{INDENT}{INDENT}transform: translateX({xpos}%)')
        if opacity is not None:
            print(f'{INDENT}{INDENT}opacity: {opacity}')
    print()


def make_marquee(n):
    total_s = n * (SHOW + SLIDE_DURATION)
    print(f'.marquee-{n}elt')
    print(f'{INDENT}@extend %marquee')
    print()
    for i in range(1, n + 1):
        print(f'{INDENT}div:nth-child({i})')
        print(f'{INDENT}{INDENT}animation: marquee-{n}elt-{i} {total_s}s ease infinite')
        print()

    # Example for two lines of text, showing the special requirements for the first line of text
    #           0s          4s          6s         10s        12s
    # text1:    ||  show    |  slide out |         | slide in  ||  show
    # text2:    ||          |  slide in  | show    | slide out ||

    for i in range(1, n + 1):
        keyframes = []
        if i == 1:
            slide_in_start_at_s = total_s - SLIDE_DURATION
            keyframes.append(Keyframe(time=0, xpos=0, opacity=1))
        else:
            slide_in_start_at_s = (i - 2) * SLIDE_DURATION + (i - 1) * SHOW
            keyframes.append(Keyframe(time=0, xpos=100, opacity=0))
        keyframes.append(Keyframe(time=slide_in_start_at_s - 1, xpos=100, opacity=0))
        keyframes.append(Keyframe(time=slide_in_start_at_s, xpos=100, opacity=1))
        slide_in_end_at_s = slide_in_start_at_s + SLIDE_DURATION
        keyframes.append(Keyframe(time=slide_in_end_at_s, xpos=0, opacity=1))
        show_end_at_s = SHOW if (i == 1) else (slide_in_end_at_s + SHOW)
        keyframes.append(Keyframe(time=show_end_at_s, xpos=0, opacity=None))
        slide_out_end_at_s = show_end_at_s + SLIDE_DURATION
        keyframes.append(Keyframe(time=slide_out_end_at_s, xpos=-100, opacity=1))
        if slide_out_end_at_s < total_s:
            keyframes.append(Keyframe(time=slide_out_end_at_s + 1, xpos=-100, opacity=0))

            if i > 1:
                keyframes.append(Keyframe(time=total_s, xpos=-100, opacity=0))

        keyframes.sort()
        write_keyframes(n, i, total_s, keyframes)


if __name__ == '__main__':
    make_marquee(2)
    make_marquee(3)
