Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class KilljoyConsole {
  [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
'@
if($env:KJ_DEBUG-ne'1'){[KilljoyConsole]::ShowWindow([KilljoyConsole]::GetConsoleWindow(),0) | Out-Null}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$base = 'http://127.0.0.1:17860/api'
$script:startedHere = $false

function Api([string]$path,[string]$method='GET',$payload=$null) {
  $p=@{Uri="$base$path";Method=$method;TimeoutSec=15}
  if($null-ne$payload){$p.ContentType='application/json; charset=utf-8';$p.Body=$payload|ConvertTo-Json -Depth 12}
  Invoke-RestMethod @p
}
function IsRunning { try {$null=Api '/state';$true}catch{$false} }
function StartCore {
  if(IsRunning){
    try { $null=Api '/clips'; return } catch {
      try { Api '/shutdown' 'POST' @{} | Out-Null; Start-Sleep -Milliseconds 700 } catch {
        $line=(netstat -ano | Select-String '127.0.0.1:17860\s+0.0.0.0:0\s+LISTENING').Line
        if($line){$oldPid=[int](($line -split '\s+')[-1]);Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue;Start-Sleep -Milliseconds 700}
      }
    }
  }
  Start-Process node.exe -ArgumentList 'src/server.js' -WorkingDirectory $root -WindowStyle Hidden | Out-Null
  $script:startedHere=$true
  for($attempt=0;$attempt-lt25;$attempt++){
    Start-Sleep -Milliseconds 300
    if(IsRunning){return}
  }
  throw 'O núcleo do OVERDRIVE não iniciou.'
}
function Msg($text,$title='Killjoy Control'){[System.Windows.MessageBox]::Show($text,$title,'OK','Information')|Out-Null}
function Ask($text){[System.Windows.MessageBox]::Show($text,'Confirmar protocolo','YesNo','Warning')-eq'Yes'}

$xaml=@'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Title="Killjoy Control // OVERDRIVE" Width="1260" Height="760" MinWidth="1000" MinHeight="620" WindowStartupLocation="CenterScreen" Background="#080D13" Foreground="#EDF5F3" FontFamily="Segoe UI">
<Window.Resources>
 <Style TargetType="Button"><Setter Property="Foreground" Value="#EDF5F3"/><Setter Property="Background" Value="#182630"/><Setter Property="BorderBrush" Value="#354B58"/><Setter Property="Padding" Value="12,9"/><Setter Property="Margin" Value="4"/></Style>
 <Style x:Key="Primary" TargetType="Button"><Setter Property="Foreground" Value="#10150D"/><Setter Property="Background" Value="#FFD836"/><Setter Property="BorderBrush" Value="#FFD836"/><Setter Property="Padding" Value="12,9"/><Setter Property="Margin" Value="4"/><Setter Property="FontWeight" Value="Bold"/></Style>
 <Style x:Key="Nav" TargetType="Button"><Setter Property="Foreground" Value="#CAD7DA"/><Setter Property="Background" Value="Transparent"/><Setter Property="BorderBrush" Value="Transparent"/><Setter Property="Padding" Value="14,11"/><Setter Property="Margin" Value="8,2"/><Setter Property="HorizontalContentAlignment" Value="Left"/></Style>
 <Style TargetType="TextBox"><Setter Property="Foreground" Value="#EDF5F3"/><Setter Property="Background" Value="#0A131A"/><Setter Property="BorderBrush" Value="#344956"/><Setter Property="Padding" Value="9"/><Setter Property="Margin" Value="0,5,0,12"/></Style>
 <Style TargetType="ComboBox"><Setter Property="Foreground" Value="#101820"/><Setter Property="Background" Value="#E3EAEC"/><Setter Property="Padding" Value="7"/><Setter Property="Margin" Value="0,5,0,12"/></Style>
 <Style TargetType="ListBox"><Setter Property="Foreground" Value="#EDF5F3"/><Setter Property="Background" Value="#0B151D"/><Setter Property="BorderBrush" Value="#2C404C"/></Style>
 <Style TargetType="GroupBox"><Setter Property="Foreground" Value="#FFD836"/><Setter Property="BorderBrush" Value="#2C404C"/><Setter Property="Padding" Value="14"/><Setter Property="Margin" Value="7"/></Style>
</Window.Resources>
<Grid><Grid.ColumnDefinitions><ColumnDefinition Width="245"/><ColumnDefinition/></Grid.ColumnDefinitions>
 <Border Background="#0B1219" BorderBrush="#2C404C" BorderThickness="0,0,1,0"><DockPanel><StackPanel DockPanel.Dock="Top"><StackPanel Orientation="Horizontal" Margin="20,24"><Border Width="44" Height="44" Background="#FFD836" CornerRadius="8"><TextBlock Text="KJ" Foreground="#10150D" FontSize="18" FontWeight="Black" HorizontalAlignment="Center" VerticalAlignment="Center"/></Border><StackPanel Margin="12,3"><TextBlock Text="KILLJOY" FontSize="17" FontWeight="Bold"/><TextBlock Text="CONTROL // OVERDRIVE" Foreground="#24E6D2" FontSize="9"/></StackPanel></StackPanel><Button x:Name="N0" Style="{StaticResource Nav}" Content="◈   Central"/><Button x:Name="N1" Style="{StaticResource Nav}" Content="#   Canais"/><Button x:Name="N2" Style="{StaticResource Nav}" Content="◆   Cargos"/><Button x:Name="N3" Style="{StaticResource Nav}" Content="◉   Membros"/><Button x:Name="N4" Style="{StaticResource Nav}" Content="▶   Arena de Clipes"/><Button x:Name="N5" Style="{StaticResource Nav}" Content="⚡   Automações"/><Button x:Name="N6" Style="{StaticResource Nav}" Content="♫   Voz &amp; DJ"/><Button x:Name="N7" Style="{StaticResource Nav}" Content="≡   Auditoria"/></StackPanel><Border DockPanel.Dock="Bottom" Margin="16" Padding="12" Background="#111C24" BorderBrush="#2C404C" BorderThickness="1" CornerRadius="8"><StackPanel><TextBlock x:Name="Status" Text="● CONECTANDO" Foreground="#FFD836" FontWeight="Bold"/><TextBlock x:Name="BotName" Text="OVERDRIVE" Foreground="#91A3AD" FontSize="10"/></StackPanel></Border></DockPanel></Border>
 <Grid Grid.Column="1" Margin="28"><Grid.RowDefinitions><RowDefinition Height="75"/><RowDefinition/></Grid.RowDefinitions><Grid><StackPanel><TextBlock Text="LABORATÓRIO DOS PATIFES" Foreground="#FFD836" FontSize="10" FontWeight="Bold"/><TextBlock x:Name="Title" Text="Central de Operações" FontSize="26" FontWeight="Bold" Margin="0,6"/></StackPanel><Button x:Name="Refresh" Content="↻ Atualizar" HorizontalAlignment="Right" VerticalAlignment="Top"/></Grid>
 <TabControl x:Name="Tabs" Grid.Row="1" Background="Transparent" BorderThickness="0"><TabControl.Resources><Style TargetType="TabItem"><Setter Property="Visibility" Value="Collapsed"/></Style></TabControl.Resources>
  <TabItem><Grid><Grid.RowDefinitions><RowDefinition Height="155"/><RowDefinition/></Grid.RowDefinitions><UniformGrid Columns="3"><GroupBox Header="NÚCLEO"><StackPanel><TextBlock x:Name="DashState" Text="ONLINE" Foreground="#A8FF3E" FontSize="29" FontWeight="Bold"/><TextBlock x:Name="DashBot" Foreground="#91A3AD"/></StackPanel></GroupBox><GroupBox Header="SERVIDOR"><StackPanel><TextBlock x:Name="DashGuild" FontSize="24" FontWeight="Bold"/><TextBlock x:Name="DashMembers" Foreground="#91A3AD"/></StackPanel></GroupBox><GroupBox Header="ESTRUTURA"><StackPanel><TextBlock x:Name="DashStructure" FontSize="22" FontWeight="Bold"/><TextBlock Text="Leitura em tempo real" Foreground="#91A3AD"/></StackPanel></GroupBox></UniformGrid><GroupBox Grid.Row="1" Header="CENTRAL NATIVA"><StackPanel><TextBlock Text="Arena • eventos • boas-vindas • cargos • canais • membros • DJ • backups • auditoria" FontSize="17"/><TextBlock Text="Esta janela é um aplicativo nativo do Windows. Nenhum navegador ou site é aberto." Foreground="#91A3AD" Margin="0,14,0,20"/><Button x:Name="Backup" Style="{StaticResource Primary}" Content="Criar backup estrutural" HorizontalAlignment="Left"/></StackPanel></GroupBox></Grid></TabItem>
  <TabItem><Grid><Grid.ColumnDefinitions><ColumnDefinition Width="2*"/><ColumnDefinition/></Grid.ColumnDefinitions><GroupBox Header="CANAIS"><ListBox x:Name="Channels" DisplayMemberPath="name"/></GroupBox><GroupBox Grid.Column="1" Header="CRIAR CANAL"><StackPanel><TextBlock Text="Nome"/><TextBox x:Name="ChannelName"/><TextBlock Text="Tipo"/><ComboBox x:Name="ChannelType" SelectedIndex="0"><ComboBoxItem Content="Texto" Tag="0"/><ComboBoxItem Content="Voz" Tag="2"/><ComboBoxItem Content="Categoria" Tag="4"/></ComboBox><TextBlock Text="Tópico"/><TextBox x:Name="ChannelTopic" Height="90" AcceptsReturn="True"/><Button x:Name="CreateChannel" Style="{StaticResource Primary}" Content="Revisar e criar"/></StackPanel></GroupBox></Grid></TabItem>
  <TabItem><Grid><Grid.ColumnDefinitions><ColumnDefinition Width="2*"/><ColumnDefinition/></Grid.ColumnDefinitions><GroupBox Header="CARGOS"><ListBox x:Name="Roles" DisplayMemberPath="name"/></GroupBox><GroupBox Grid.Column="1" Header="CRIAR CARGO"><StackPanel><TextBlock Text="Nome"/><TextBox x:Name="RoleName"/><TextBlock Text="Cor"/><TextBox x:Name="RoleColor" Text="#FFD84D"/><CheckBox x:Name="RoleHoist" Content="Exibir separadamente" Margin="0,8"/><CheckBox x:Name="RoleMention" Content="Permitir menção" Margin="0,8,0,18"/><Button x:Name="CreateRole" Style="{StaticResource Primary}" Content="Revisar e criar"/></StackPanel></GroupBox></Grid></TabItem>
  <TabItem><GroupBox Header="MEMBROS DO PATIFES"><DockPanel><Button x:Name="LoadMembers" DockPanel.Dock="Top" Content="Atualizar membros"/><ListBox x:Name="Members" DisplayMemberPath="name"/></DockPanel></GroupBox></TabItem>
  <TabItem><Grid><Grid.ColumnDefinitions><ColumnDefinition/><ColumnDefinition/></Grid.ColumnDefinitions><GroupBox Header="TEMPORADA"><StackPanel><TextBlock x:Name="Season" FontSize="28" FontWeight="Bold"/><TextBlock x:Name="SeasonEnd" Foreground="#91A3AD"/><ListBox x:Name="ClipList" DisplayMemberPath="title" Margin="0,15"/><Button x:Name="Finalize" Content="Encerrar e premiar agora"/></StackPanel></GroupBox><GroupBox Grid.Column="1" Header="COMANDOS"><StackPanel><TextBlock Text="/clipe enviar" Foreground="#24E6D2" FontSize="20" FontWeight="Bold"/><TextBlock Text="Recebe vídeo, título, jogo e categoria; publica o cartão com votação." TextWrapping="Wrap" Margin="0,4,0,20"/><TextBlock Text="/clipe ranking" Foreground="#24E6D2" FontSize="20" FontWeight="Bold"/><TextBlock Text="Mostra o placar atualizado da temporada." TextWrapping="Wrap"/></StackPanel></GroupBox></Grid></TabItem>
  <TabItem><Grid><Grid.ColumnDefinitions><ColumnDefinition/><ColumnDefinition/></Grid.ColumnDefinitions><GroupBox Header="BOAS-VINDAS"><StackPanel><CheckBox x:Name="WelcomeOn" Content="Ativar recepção" Margin="0,8"/><TextBlock Text="Canal"/><ComboBox x:Name="WelcomeChannel" DisplayMemberPath="name" SelectedValuePath="id"/><TextBlock Text="Mensagem"/><TextBox x:Name="WelcomeText" Height="100" AcceptsReturn="True" TextWrapping="Wrap"/><Button x:Name="SaveWelcome" Style="{StaticResource Primary}" Content="Salvar"/></StackPanel></GroupBox><GroupBox Grid.Column="1" Header="CRIAR EVENTO"><StackPanel><TextBlock Text="Canal"/><ComboBox x:Name="EventChannel" DisplayMemberPath="name" SelectedValuePath="id"/><TextBlock Text="Título"/><TextBox x:Name="EventTitle"/><TextBlock Text="Descrição"/><TextBox x:Name="EventText" Height="60"/><TextBlock Text="Data/hora: 28/07/2026 21:00"/><TextBox x:Name="EventDate"/><Button x:Name="CreateEvent" Style="{StaticResource Primary}" Content="Publicar evento"/></StackPanel></GroupBox></Grid></TabItem>
  <TabItem><GroupBox Header="DJ LOCAL"><StackPanel Width="650"><TextBlock Text="Call"/><ComboBox x:Name="VoiceChannel" DisplayMemberPath="name" SelectedValuePath="id"/><TextBlock Text="Arquivo do PC"/><TextBox x:Name="AudioPath" Text="C:\Users\User\Downloads\"/><TextBlock Text="Volume protegido (1–25%)"/><Slider x:Name="Volume" Minimum="1" Maximum="25" Value="8"/><TextBlock x:Name="VolumeText" Text="8%" HorizontalAlignment="Right"/><WrapPanel Margin="0,18"><Button x:Name="Join" Style="{StaticResource Primary}" Content="Entrar"/><Button x:Name="Play" Content="Tocar"/><Button x:Name="Stop" Content="Parar"/><Button x:Name="Leave" Content="Sair"/></WrapPanel></StackPanel></GroupBox></TabItem>
  <TabItem><GroupBox Header="CAIXA-PRETA"><ListBox x:Name="Logs" DisplayMemberPath="detail"/></GroupBox></TabItem>
 </TabControl></Grid></Grid></Window>
'@

try{StartCore}catch{Msg $_.Exception.Message 'Falha';exit}
$reader=New-Object Xml.XmlNodeReader([xml]$xaml);$w=[Windows.Markup.XamlReader]::Load($reader)
function E($n){$w.FindName($n)}
$script:server=$null
function Reload($index){
 try{$s=Api '/state';(E Status).Text=if($s.connected){'● OVERDRIVE ONLINE'}else{'● OVERDRIVE OFFLINE'};(E Status).Foreground=if($s.connected){'#A8FF3E'}else{'#FF5165'};(E BotName).Text=$s.user.tag;if(!$s.connected){return};$script:server=Api '/server';(E DashBot).Text=$s.user.tag;(E DashGuild).Text=$s.guild.name;(E DashMembers).Text="$($s.guild.members) membros";(E DashStructure).Text="$($script:server.channels.Count) canais / $($script:server.roles.Count) cargos";(E Channels).ItemsSource=$script:server.channels;(E Roles).ItemsSource=$script:server.roles
  $texts=@($script:server.channels|?{$_.type-in@(0,5,15)});$calls=@($script:server.channels|?{$_.type-in@(2,13)});(E WelcomeChannel).ItemsSource=$texts;(E EventChannel).ItemsSource=$texts;(E VoiceChannel).ItemsSource=$calls
  if($index-eq4){$d=(Api '/clips').data;(E Season).Text="TEMPORADA #$($d.season)";(E SeasonEnd).Text="Termina em $([datetime]$d.endsAt)";(E ClipList).ItemsSource=@($d.entries|?{-not$_.deleted})};if($index-eq5){$a=(Api '/automations').data;(E WelcomeOn).IsChecked=$a.welcome.enabled;(E WelcomeText).Text=$a.welcome.message;(E WelcomeChannel).SelectedValue=$a.welcome.channelId};if($index-eq7){(E Logs).ItemsSource=(Api '/audit').items}
 }catch{Msg $_.Exception.Message 'Erro do laboratório'}
}
$titles=@('Central de Operações','Arquitetura de Canais','Engenharia de Cargos','Banco de Membros','Arena de Clipes','Automações e Eventos','Voz e DJ','Auditoria')
0..7|%{$i=$_;$b=E "N$i";$b.Add_Click({(E Tabs).SelectedIndex=$i;(E Title).Text=$titles[$i];Reload $i}.GetNewClosure())}
(E Refresh).Add_Click({Reload (E Tabs).SelectedIndex});(E Backup).Add_Click({try{$r=Api '/backup' 'POST' @{};Msg "Backup criado: $($r.name)"}catch{Msg $_.Exception.Message}})
(E CreateChannel).Add_Click({try{$p=(Api '/plan' 'POST' @{kind='channel.create';payload=@{name=(E ChannelName).Text;type=[int](E ChannelType).SelectedItem.Tag;topic=(E ChannelTopic).Text}}).plan;if(Ask $p.summary){Api '/execute' 'POST' @{id=$p.id}|Out-Null;Msg 'Canal criado.';Reload 1}}catch{Msg $_.Exception.Message}})
(E CreateRole).Add_Click({try{$p=(Api '/plan' 'POST' @{kind='role.create';payload=@{name=(E RoleName).Text;color=(E RoleColor).Text;hoist=(E RoleHoist).IsChecked;mentionable=(E RoleMention).IsChecked}}).plan;if(Ask $p.summary){Api '/execute' 'POST' @{id=$p.id}|Out-Null;Msg 'Cargo criado.';Reload 2}}catch{Msg $_.Exception.Message}})
(E LoadMembers).Add_Click({try{(E Members).ItemsSource=(Api '/members').members}catch{Msg $_.Exception.Message}});(E Finalize).Add_Click({if(Ask 'Encerrar a temporada e premiar o líder?'){Api '/clips/finalize' 'POST' @{}|Out-Null;Reload 4}})
(E SaveWelcome).Add_Click({try{Api '/automations' 'POST' @{welcome=@{enabled=(E WelcomeOn).IsChecked;channelId=(E WelcomeChannel).SelectedValue;message=(E WelcomeText).Text;autoRoleId=''}}|Out-Null;Msg 'Automação salva.'}catch{Msg $_.Exception.Message}})
(E CreateEvent).Add_Click({try{$d=[datetime]::Parse((E EventDate).Text);Api '/events' 'POST' @{channelId=(E EventChannel).SelectedValue;title=(E EventTitle).Text;description=(E EventText).Text;startsAt=$d.ToString('o')}|Out-Null;Msg 'Evento publicado.'}catch{Msg $_.Exception.Message}})
(E Volume).Add_ValueChanged({(E VolumeText).Text="$([int](E Volume).Value)%"});(E Join).Add_Click({try{Api '/voice/join' 'POST' @{channelId=(E VoiceChannel).SelectedValue}|Out-Null;Msg 'OVERDRIVE entrou na call.'}catch{Msg $_.Exception.Message}});(E Play).Add_Click({try{Api '/voice/play' 'POST' @{file=(E AudioPath).Text;volume=((E Volume).Value/100)}|Out-Null}catch{Msg $_.Exception.Message}});(E Stop).Add_Click({Api '/voice/stop' 'POST' @{}|Out-Null});(E Leave).Add_Click({Api '/voice/leave' 'POST' @{}|Out-Null})
if($env:KJ_TEST-eq'1'){Reload 0;Write-Output 'KILLJOY_NATIVE_READY';$w.Close();exit 0}
$w.Add_ContentRendered({Reload 0})
$w.ShowDialog()|Out-Null
