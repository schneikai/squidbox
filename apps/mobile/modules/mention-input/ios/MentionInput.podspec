Pod::Spec.new do |s|
  s.name           = 'MentionInput'
  s.version        = '1.0.0'
  s.summary        = 'A text field that holds mentions as chips inside its text'
  s.description    = 'A text field that holds mentions as chips inside its text'
  s.license        = 'UNLICENSED'
  s.author         = 'Squidbox'
  s.homepage       = 'https://github.com/schneikai/squidbox'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
