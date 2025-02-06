
PACKAGENAME:=$(shell grep '^Package:' DEBIAN/control | sed 's/^Package:[[:space:]]*//')
PACKAGEVERSION:=$(shell grep '^Version:' DEBIAN/control | sed 's/^Version:[[:space:]]*//')
PACKAGEARCH:=$(shell grep '^Architecture:' DEBIAN/control | sed 's/^Architecture:[[:space:]]*//')
PACKAGEFILE:=$(PACKAGENAME)_$(PACKAGEVERSION)_$(PACKAGEARCH).deb

BUILD:=.build
DEB_LIBEXEC:=$(BUILD)/usr/libexec/$(PACKAGENAME)
DEB_SYSTEMD_SYSTEM:=$(BUILD)/lib/systemd/system

DEB_LIBEXEC_COMPONENT:=seqtask.js pseudo-job
DEB_SYSTEMD_SYSTEM_COMPONENT:=control postinst prerm postrm
DEB_SYSTEMD_SYSTEM_COMPONENT_PATH:=$(shell for f in $(DEB_SYSTEMD_SYSTEM_COMPONENT) ; do echo DEBIAN/$$f ; done )

.PHONY: all clean deb-package install uninstall update status 

all: deb-package

$(BUILD):
	if [ ! -d "$(BUILD)" ] ; then mkdir -p "$(BUILD)" ; fi

$(DEB_LIBEXEC): $(BUILD) $(DEB_LIBEXEC_COMPONENT)
	if [ ! -d "${DEB_LIBEXEC}" ] ; then mkdir -p "${DEB_LIBEXEC}" ; fi
	for f in $(DEB_LIBEXEC_COMPONENT) ; do cp "$$f" "${DEB_LIBEXEC}" ; done

$(DEB_SYSTEMD_SYSTEM): $(BUILD)
	if [ ! -d "$(DEB_SYSTEMD_SYSTEM)" ] ; then mkdir -p "$(DEB_SYSTEMD_SYSTEM)" ; fi
	cp ./node-seqexec.service .build/lib/systemd/system/ 

$(PACKAGEFILE): deb-package

deb-package:$(DEB_SYSTEMD_SYSTEM) $(DEB_LIBEXEC) $(DEB_SYSTEMD_SYSTEM_COMPONENT_PATH)
	if [ ! -d "$(BUILD)/DEBIAN" ] ; then mkdir -p "$(BUILD)/DEBIAN" ; fi
	for f in $(DEB_SYSTEMD_SYSTEM_COMPONENT_PATH) ; do cp $$f $(BUILD)/DEBIAN ; done 
	fakeroot dpkg-deb --build .build .

clean:
	if [ -d "$(BUILD)" ]; then rm -rf .build ; fi 
	if [ -f "$(PACKAGEFILE)" ] ; then rm "$(PACKAGEFILE)"; fi
	find . -type f -name '*~' -delete

uninstall:
	@if [ "installed" = "$$(if dpkg-query -s $(PACKAGENAME) > /dev/null 2>&1 ; then echo installed ; fi)" ] ; then sudo apt purge -y $(PACKAGENAME) ; fi

install: $(PACKAGEFILE) uninstall
	sudo apt install -y ./node-seqexec_0.0.0_all.deb

update: $(PACKAGEFILE) 
	make uninstall && make install

status:

check:
	@echo $(DEB_SYSTEMD_SYSTEM_COMPONENT_PATH)
	@echo "package name	: \"$(PACKAGENAME)\""
	@echo "package version	: \"$(PACKAGEVERSION)\""
	@echo "package file     : \"$(PACKAGEFILE)\""
	@echo "libexec path	: \"$(DEB_LIBEXEC)\""
	@echo "systemd_path	: \"$(DEB_SYSTEMD_SYSTEM)\""

