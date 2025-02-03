# node-seqexec

node.js sequencial executor

## debパッケージの作り方
 fakeroot が必要です。 必要に応じて apt install fakeroot で入れてください。

```
make
```
で node-seqexec_0.0.0_all.deb が作成されます。
```
apt install ./node-seqexec_0.0.0_all.deb
```
ローカルの.debファイルをインストール出来ます。

```
apt purge node-seqexe
```

でアンインストールできます。

## file

- node-seqexec.service

Systemd の設定ファイルです。
.deb パッケージは /lib/systemd/system にインストールされます。

単独で使うときは /etc/systemd/system に配置して ```systemctl daemon-reload```
```systemctl start node-seqexec``` でスタート 再起動時に有効化されるようにするには ```systemctl enable nodeseqexec``` です。

-- test-seqtask.sh

同時に複数の POST が行われた時のテスト用のスクリプト

