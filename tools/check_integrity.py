from argparse import ArgumentParser
import base64
import binascii
import hashlib
from pathlib import Path
import sys


def parse_args():
    parser = ArgumentParser()
    parser.add_argument('algorithm', choices='sha256 sha384 sha512'.split())
    parser.add_argument('filename', type=Path)
    parser.add_argument('expected')
    args = parser.parse_args()
    if not args.filename.is_file():
        parser.error("Input file not found")
    try:
        args.expected = base64.b64decode(args.expected)
    except binascii.Error:
        parser.error("Invalid check value")
    return args


def main():
    args = parse_args()

    if args.algorithm == 'sha256':
        hash = hashlib.sha256()
    elif args.algorithm == 'sha384':
        hash = hashlib.sha384()
    elif args.algorithm == 'sha512':
        hash = hashlib.sha512()
    else:
        sys.exit("Unrecognised hash algorithm")


    with args.filename.open('rb') as handle:
        hash.update(handle.read())

    actual = hash.digest()
    if actual != args.expected:
        sys.exit(f"Checksum mismatch: Expected {args.expected}, got {actual}")


if __name__ == '__main__':
    main()
