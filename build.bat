"C:\MSFS_SDK\Tools\bin\fspackagetool.exe" "Build\sn-thump.xml" -nopause
mkdir "Build\Packages\sn-thump\InGamePanels"
copy /Y "Build\Packages\sn-thump\Build\sn-thump.spb" "Build\Packages\sn-thump\InGamePanels\sn-thump.spb"
xcopy /E /I /Y "html_ui" "Build\Packages\sn-thump\html_UI"
copy /Y "icon.png" "Build\Packages\sn-thump\icon.png"
copy /Y "layout.json" "Build\Packages\sn-thump\layout.json"