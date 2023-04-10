INDENT='    '
SLIDE_DURATION = 2
SHOW = 4


# based on https://www.hongkiat.com/blog/css3-animation-advanced-marquee/

def make_marquee(n):
    total_s = n * SHOW + (n + 1) * SLIDE_DURATION
    print(f'.marquee-{n}elt')
    print(f'{INDENT}@extend %marquee')
    print()
    for i in range(1, n + 1):
        print(f'{INDENT}div:nth-child({i})')
        print(f'{INDENT}{INDENT}animation: marquee-{n}elt-{i} {total_s}s ease infinite')
        print()

    for i in range(1, n + 1):
        keyframes = []
        slide_in_start_at_s = (i-1) * (SLIDE_DURATION + SHOW)
        if slide_in_start_at_s > 0:
            keyframes.append((0, 100))
        keyframes.append((slide_in_start_at_s, 100))
        slide_in_end_at_s = slide_in_start_at_s + SLIDE_DURATION
        keyframes.append((slide_in_end_at_s, 0))
        show_end_at_s = slide_in_end_at_s + SHOW
        keyframes.append((show_end_at_s, 0))
        slide_out_end_at_s = show_end_at_s + SLIDE_DURATION
        keyframes.append((slide_out_end_at_s, -100))
        if slide_out_end_at_s < total_s:
            keyframes.append((total_s, -100))

        keyframes.sort()

        print(f'@keyframes marquee-{n}elt-{i}')
        for (s, xpos) in keyframes:
            pct = int(round(100 * s / total_s))
            print(f'{INDENT}/* {s} */')
            print(f'{INDENT}{pct}%')
            print(f'{INDENT}{INDENT}transform: translateX({xpos}%)')
        print()


if __name__ == '__main__':
    make_marquee(2)
    make_marquee(3)
