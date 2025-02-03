
.PHONY: all clean deb-package

all: deb-package

deb-package:
	if [ ! -d .build ] ; then mkdir .build ; fi
	if [ ! -d .build/usr/libexec/node-seqexec ] ; then mkdir -p .build/usr/libexec/node-seqexec ; fi
	if [ ! -d .build/lib/systemd/system ] ; then mkdir -p .build/lib/systemd/system ; fi
	cp ./seqtask.js .build/usr/libexec/node-seqexec/
	cp ./pseudo-job .build/usr/libexec/node-seqexec/
	cp ./node-seqexec.service .build/lib/systemd/system/ 
	cp -r DEBIAN ./.build/DEBIAN 
	fakeroot dpkg-deb --build .build .

clean:
	find . -type f -name '*~' -delete
	rm -rf .build

