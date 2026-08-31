param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$CommandArgs
)

$ErrorActionPreference = "Stop"
node "$PSScriptRoot\with-project-rust.mjs" @CommandArgs
