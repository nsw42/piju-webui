#! /bin/bash

ROOT_DIR=$(dirname $0)
THIRD_PARTY_DIR=$ROOT_DIR/static/ext

mkdir -p "$THIRD_PARTY_DIR"

function fetch() {
  case $# in
    1)
      url=$1
      alg=
      destfn=$(echo "$url" | sed 's:^.*/::')
      ;;

    3)
      url=$1
      alg=$2
      val=$3
      destfn=$(echo "$url" | sed 's:^.*/::')
      ;;

    4)
      url=$1
      destfn=$2
      alg=$3
      val=$4
      ;;

    *)
      echo "Unrecognised arguments ($#) $@"
      exit 1
      ;;
  esac

  destfn=$THIRD_PARTY_DIR/$destfn

  # download
  echo "$destfn"
  curl -L -o "$destfn" "$url"

  # check integrity
  if [ "$alg" ]; then
    python3 "$ROOT_DIR/tools/check_integrity.py"  "$alg"  "$destfn"  "$val" || { echo Integrity check failed; exit 1; }
  fi
}

fetch "https://code.jquery.com/jquery-3.6.0.min.js"                                                                       sha256  "/xUj+3OJU5yExlq6GSYGSHk7tPXikynS7ogEvDej/m4="
fetch "https://cdn.jsdelivr.net/npm/@popperjs/core@2.11.6/dist/umd/popper.min.js"                                         sha384  "oBqDVmMz9ATKxIep9tiCxS/Z9fNfEXiDAYTujMAeBAsjFuCZSmKbSSUnQlmh/jp3"
fetch "https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/js/bootstrap.min.js"                                             sha384  "IDwe1+LCz02ROU9k972gdyvl+AESN10+x7tBKgc9I5HFtuNz0wWnPclzo6p9vxnk"
fetch "https://gitcdn.github.io/bootstrap-toggle/2.2.2/js/bootstrap-toggle.min.js"
fetch "https://cdn.jsdelivr.net/npm/js-cookie@3.0.1/dist/js.cookie.min.js"                                                sha256  "0H3Nuz3aug3afVbUlsu12Puxva3CP4EhJtPExqs54Vg="
fetch "https://cdn.jsdelivr.net/npm/bootswatch@5.2.3/dist/slate/bootstrap.min.css"   bootswatch_slate_bootstrap.min.css   sha256  "VHeArc9kdO/1rwrV+DWV2nLoqS3ZLIb1KeUjmSK0HBE="
fetch "https://cdn.jsdelivr.net/npm/bootstrap@5.2.0-beta1/dist/css/bootstrap.min.css"                                     sha384  "0evHe/X+R7YkIZDRvuzKMRqM+OrBnVFBL6DOitfPri4tjfHxaWutUpFmBp4vmVor"
fetch "https://gitcdn.github.io/bootstrap-toggle/2.2.2/css/bootstrap-toggle.min.css"
fetch "https://maxst.icons8.com/vue-static/landings/line-awesome/line-awesome/1.3.0/css/line-awesome.min.css"
