#! /bin/sh

function usage() {
  echo "Usage: $0 [OPTIONS]"
  echo "Options:"
  echo "  -u   Fetch all files, even if local versions already exist"
  exit 1
}

update=false

while getopts hu arg; do
  case $arg in
    u)
      update=true
      ;;
    *)
      usage
      ;;
  esac
done


ROOT_DIR=$(dirname $0)
THIRD_PARTY_DIR=$ROOT_DIR/static/ext

function fetch() {
  case $# in
    2)
      url=$1
      destdir=$2
      alg=
      destfn=$(echo "$url" | sed 's:^.*/::')
      ;;

    4)
      url=$1
      destdir=$2
      alg=$3
      val=$4
      destfn=$(echo "$url" | sed 's:^.*/::')
      ;;

    5)
      url=$1
      destdir=$2
      destfn=$3
      alg=$4
      val=$5
      ;;

    *)
      echo "Unrecognised arguments ($#) $@"
      exit 1
      ;;
  esac

  mkdir -p $THIRD_PARTY_DIR/$destdir

  destfn=$THIRD_PARTY_DIR/$destdir/$destfn

  # download
  echo "$destfn"
  if $update || [ ! -f "$destfn" ]; then
    which curl > /dev/null 2>&1 && {
      curl -L -o "$destfn" "$url"
    } || {
      which wget > /dev/null 2>&1 && {
        wget -O "$destfn" "$url"
      } || {
        echo Cannot find curl or wget
        exit 1
      }
    }
  fi

  # check integrity
  if [ "$alg" ]; then
    python3 "$ROOT_DIR/tools/check_integrity.py"  "$alg"  "$destfn"  "$val" || { echo Integrity check failed; exit 1; }
  fi
}

fetch "https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"                   js                                     sha256  "/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo="
fetch "https://cdn.jsdelivr.net/npm/@popperjs/core@2.11.6/dist/umd/popper.min.js"      js                                     sha384  "oBqDVmMz9ATKxIep9tiCxS/Z9fNfEXiDAYTujMAeBAsjFuCZSmKbSSUnQlmh/jp3"
fetch "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.min.js"          js                                     sha256  "3gQJhtmj7YnV1fmtbVcnAV6eI4ws0Tr48bVZCThtCGQ="
fetch "https://gitcdn.github.io/bootstrap-toggle/2.2.2/js/bootstrap-toggle.min.js"     js
fetch "https://cdn.jsdelivr.net/npm/js-cookie@3.0.1/dist/js.cookie.min.js"             js                                     sha256  "0H3Nuz3aug3afVbUlsu12Puxva3CP4EhJtPExqs54Vg="
fetch "https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js"                 js                                     sha256  "ipiJrswvAR4VAx/th+6zWsdeYmVae0iJuiR+6OqHJHQ="
fetch "https://cdn.jsdelivr.net/npm/bootswatch@5.3.3/dist/slate/bootstrap.min.css"     css bootswatch_slate_bootstrap.min.css sha256  "wiAh4n8qc/EvV4YhAjqU+bA9sW69vgGMP+LYATjdTj0="
fetch "https://gitcdn.github.io/bootstrap-toggle/2.2.2/css/bootstrap-toggle.min.css"   css
fetch "https://maxst.icons8.com/vue-static/landings/line-awesome/line-awesome/1.3.0/css/line-awesome.min.css"  css

# Line Awesome
for font in la-solid-900.woff la-solid-900.woff2 la-brands-400.woff la-brands-400.woff2; do
  fetch "https://maxst.icons8.com/vue-static/landings/line-awesome/line-awesome/1.3.0/fonts/$font"  fonts
done
