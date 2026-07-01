"C:\MSFS_SDK\Tools\bin\fspackagetool.exe" "Build\sn-thump.xml" -nopause
xcopy /E /I /Y "html_ui" "Build\Packages\sn-thump\html_ui"
copy /Y "icon.png" "Build\Packages\sn-thump\icon.png"
"C:\MSFS_SDK\Tools\bin\fspackagetool.exe" "Build\sn-thump.xml" -nopause