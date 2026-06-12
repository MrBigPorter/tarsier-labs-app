#!/usr/bin/env ruby
# Test script to generate and verify App Store Connect API JWT
# Uses the SAME code path as Spaceship::ConnectAPI::Token

require 'jwt'
require 'base64'
require 'openssl'

# Read the p8 file directly (same as Fastlane does with File.binread)
p8_path = File.expand_path('~/Downloads/AuthKey_5WBC553SQ4.p8')
p8_content = File.binread(p8_path)

puts "=== P8 File Info ==="
puts "Path: #{p8_path}"
puts "Size: #{p8_content.bytesize} bytes"
puts "Content preview (first 64 chars): #{p8_content[0..63]}"
puts

# Parse the EC key
key = OpenSSL::PKey::EC.new(p8_content)
puts "=== EC Key Verification ==="
puts "check_key: #{key.check_key}"
puts "Key class: #{key.class}"
puts "Group curve name: #{key.group.curve_name}"
puts

# Now simulate the Spaceship Token.create flow
key_id = "5WBC553SQ4"
issuer_id = "9f6d8151-f70c-4f1e-8857-800979309bc3"

# Build header and payload EXACTLY like Spaceship::ConnectAPI::Token#refresh!
now = Time.now
duration = 500
expiration = now + duration

header = {
  kid: key_id,
  typ: 'JWT'
}

payload = {
  iat: now.to_i - 60,  # 60 seconds leeway as Spaceship does
  exp: expiration.to_i,
  aud: 'appstoreconnect-v1',
  iss: issuer_id
}

puts "=== JWT Payload ==="
payload.each { |k, v| puts "  #{k}: #{v}" }
puts

# Encode the JWT
token = JWT.encode(payload, key, 'ES256', header)
puts "=== Generated Token ==="
puts token
puts

# Decode and verify the token locally (without verification)
decoded = JWT.decode(token, nil, false)
puts "=== Decoded Token (no verification) ==="
puts "Header: #{decoded[1]}"
puts "Payload: #{decoded[0]}"
puts

# Now also test with the alternative key
puts "=== Also testing UBW264Z9Z8 key ==="
p8_path2 = File.expand_path('~/Downloads/AuthKey_UBW264Z9Z8.p8')
if File.exist?(p8_path2)
  p8_content2 = File.binread(p8_path2)
  key2 = OpenSSL::PKey::EC.new(p8_content2)
  puts "Key 2 check_key: #{key2.check_key}"
  
  header2 = { kid: "UBW264Z9Z8", typ: 'JWT' }
  token2 = JWT.encode(payload, key2, 'ES256', header2)
  puts "Token 2: #{token2[0..80]}..."
  
  decoded2 = JWT.decode(token2, nil, false)
  puts "Token 2 header kid: #{decoded2[1]['kid']}"
  puts "Token 2 payload iss: #{decoded2[0]['iss']}"
else
  puts "UBW264Z9Z8 p8 not found at #{p8_path2}"
end

puts
puts "=== Test base64 decode ==="
# Test that what we upload as base64 decodes correctly
base64_content = Base64.encode64(p8_content)
decoded_from_b64 = Base64.decode64(base64_content)
puts "Original bytes: #{p8_content.bytesize}"
puts "Base64 length: #{base64_content.bytesize}"
puts "Decoded bytes: #{decoded_from_b64.bytesize}"
puts "Match: #{p8_content == decoded_from_b64}"

# Verify the decoded base64 creates a valid key
key_from_b64 = OpenSSL::PKey::EC.new(decoded_from_b64)
puts "Key from base64 check_key: #{key_from_b64.check_key}"
