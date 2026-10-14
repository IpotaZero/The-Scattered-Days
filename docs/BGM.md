# BGMの出どころ

`assets/bgm/` の曲の取得元とライセンス。ライセンスはWikimedia Commonsのファイルページに書かれたもの(アップロード者の申告)。2026-10-14に取得。
CC0とPublic domainは、クレジットの表記が要らない。ただしクレジット(`src/Data/Credits.ts`)には、取得元と演奏者を載せている。

| ファイル | 曲 | Commonsのファイル名 | ライセンス | 演奏・出どころ |
| --- | --- | --- | --- | --- |
| chopin-berceuse-op57.ogg | ショパン 子守唄 Op.57 | File:Chopin-Berceuse.ogg | Public domain | Veronica van der Knaap(Christchurch、公開演奏会の録音) |
| chopin-waltz-op64-2.ogg | ショパン ワルツ 嬰ハ短調 Op.64-2 | File:Chopin-waltz-op-64-no-2-in-c-sharp-minor.oga | CC0 | Musopen |
| chopin-waltz-op64-3.ogg | ショパン ワルツ 変イ長調 Op.64-3 | File:Chopin-waltz-in-a-flat-major-op-64-no-3-by-Diana-Hughes.ogg | CC0 | Musopen、Diana Hughes |
| chopin-waltz-op69-1.ogg | ショパン ワルツ 変イ長調 Op.69-1「告別」 | File:Chopin-waltz-op-69-no-1-in-a-flat-major.ogg | CC0 | Musopen |
| chopin-waltz-op69-2.ogg | ショパン ワルツ ロ短調 Op.69-2 | File:Chopin-waltz-op-69-no-2-in-b-minor.ogg | CC0 | Musopen |

取得元は `https://commons.wikimedia.org/wiki/` の後ろにファイル名を付けたページ。Musopenの曲は、Commonsのページに「Musopenが、アップロード者にパブリックドメインであることの保証を求めている」と書かれている。Op.64-2とOp.69の演奏者名は、Commonsのページからは確認できていない。

## 割り当て(`App.SetList.sceneries`)

地図を縦に割って同じ枠に入る景色は、同じ曲にしてある。枠の中を行き来しても曲は切り替わらず、枠をまたいだときだけクロスフェードする。

| 枠(地図のx) | 景色 | 曲 |
| --- | --- | --- |
| 0〜1600 | hive, frost | 子守唄 Op.57 |
| 2240〜3440 | gale, web | ワルツ Op.64-3 |
| 4160〜5360 | mist, sand, haze, iron | ワルツ Op.69-2 |
| 6180〜7380 | meteor, moon | ワルツ Op.64-2 |
| 8580〜10180 | nest | ワルツ Op.69-1「告別」 |

## 見つからなかった・使わなかった曲

- ジプシーワルツ Op.7: Commonsに見つからなかった。
- 夜想曲 Op.27-2: CC0・Public domainの全曲録音がなかった(Patrizia PratiはCC BY-SA、Mutopia版はAttribution、Frank Levyの録音は0.26MBの断片)。
- マズルカ Op.68-2: 録音はCC BY(Christoph Zbinden)のみ。使うならクレジットに表記が要る。
- 子犬のワルツ Op.64-1: 音割れのため取り除いた。
