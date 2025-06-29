from dataclasses import dataclass

INDENT = 4 * ' '


@dataclass
class Keyframe:
    time: int
    xpos: int
    opacity: int

# based on https://www.hongkiat.com/blog/css3-animation-advanced-marquee/


def write_keyframes(speed_name, n, i, total_s, keyframes):
    print(f'@keyframes marquee-{speed_name}-{n}elt-{i}')
    for kf in keyframes:
        pct = int(round(100 * kf.time / total_s))
        print(f'{INDENT}/* {kf.time} */')
        print(f'{INDENT}{pct}%')
        print(f'{INDENT}{INDENT}transform: translateX({kf.xpos}%)')
        if kf.opacity is not None:
            print(f'{INDENT}{INDENT}opacity: {kf.opacity}')
        print(f'{INDENT}{INDENT}background-color: theme.$headerfooter-background')
    print()


def make_marquee(speed_name, n, show_duration, slide_duration):
    total_s = n * (show_duration + slide_duration)
    print(f'.marquee-{speed_name} .marquee-{n}elt')
    print(f'{INDENT}@extend %marquee')
    print()
    for i in range(1, n + 1):
        print(f'{INDENT}div:nth-child({i})')
        print(f'{INDENT}{INDENT}animation: marquee-{speed_name}-{n}elt-{i} {total_s}s ease infinite')
        print()

    # Example for two lines of text, showing the special requirements for the first line of text
    #           0s          4s          6s         10s        12s
    # text1:    ||  show    |  slide out |         | slide in  ||  show
    # text2:    ||          |  slide in  | show    | slide out ||

    for i in range(1, n + 1):
        keyframes = []
        if i == 1:
            slide_in_start_at_s = total_s - slide_duration
            keyframes.append(Keyframe(time=0, xpos=0, opacity=1))
        else:
            slide_in_start_at_s = (i - 2) * slide_duration + (i - 1) * show_duration
            keyframes.append(Keyframe(time=0, xpos=100, opacity=0))
        keyframes.append(Keyframe(time=slide_in_start_at_s - 1, xpos=100, opacity=0))
        keyframes.append(Keyframe(time=slide_in_start_at_s, xpos=100, opacity=1))
        slide_in_end_at_s = slide_in_start_at_s + slide_duration
        keyframes.append(Keyframe(time=slide_in_end_at_s, xpos=0, opacity=1))
        show_end_at_s = show_duration if (i == 1) else (slide_in_end_at_s + show_duration)
        keyframes.append(Keyframe(time=show_end_at_s, xpos=0, opacity=1))
        slide_out_end_at_s = show_end_at_s + slide_duration
        keyframes.append(Keyframe(time=slide_out_end_at_s, xpos=-100, opacity=1))
        if slide_out_end_at_s < total_s:
            keyframes.append(Keyframe(time=slide_out_end_at_s + 1, xpos=-100, opacity=0))

            if i > 1:
                keyframes.append(Keyframe(time=total_s, xpos=-100, opacity=0))

        keyframes.sort(key=lambda kf: kf.time)
        write_keyframes(speed_name, n, i, total_s, keyframes)


if __name__ == '__main__':
    print('@use "theme"')
    print('@use "marquee_base"')
    print()
    for n_elts in (2, 3):
        make_marquee('fast', n_elts, show_duration=4, slide_duration=2)
        make_marquee('slow', n_elts, show_duration=4, slide_duration=4)
