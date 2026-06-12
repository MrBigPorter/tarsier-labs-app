#!/usr/bin/env ruby
# Test the JWT against Apple's App Store Connect API directly
require 'jwt'
require 'base64'
require 'openssl'
require 'net/http'
require 'json'
require 'uri'

# Read the p8 file
p8_path = File.expand_path('~/Downloads/AuthKey_5WBC553SQ4.p8')
p8_content = File.binread(p8_path)
key = OpenSSL::PKey::EC.new(p8_content)

key_id = "5WBC553SQ4"
issuer_id = "9f6d8151-f70c-4f1e-8857-800979309bc3"

# Generate JWT exactly like Spaceship::ConnectAPI::Token
now = Time.now
duration = 500
expiration = now + duration

header = { kid: key_id, typ: 'JWT' }
payload = {
  iat: now.to_i - 60,
  exp: expiration.to_i,
  aud: 'appstoreconnect-v1',
  iss: issuer_id
}

token = JWT.encode(payload, key, 'ES256', header)
puts "JWT Token (first 100 chars): #{token[0..100]}..."
puts

# Test 1: Get App Store Connect API info
# Using the /v1/apps endpoint as a simple test
puts "=== Test 1: GET /v1/apps (list apps) ==="
uri = URI('https://api.appstoreconnect.apple.com/v1/apps')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true
http.open_timeout = 10
http.read_timeout = 30

request = Net::HTTP::Get.new(uri)
request['Authorization'] = "Bearer #{token}"
request['Content-Type'] = 'application/json'

begin
  response = http.request(request)
  puts "Status: #{response.code}"
  puts "Body (first 500 chars): #{response.body[0..500]}"
  
  if response.code.to_i == 200
    data = JSON.parse(response.body)
    puts "SUCCESS! Found #{data['data']&.length} apps"
    data['data']&.each { |app| puts "  - #{app['id']}: #{app['attributes']&.dig('name')}" }
  else
    puts "FAILED with #{response.code}"
  end
rescue => e
  puts "Error: #{e.class}: #{e.message}"
end

puts
puts "=== Test 2: Test with UBW264Z9Z8 key ==="
p8_path2 = File.expand_path('~/Downloads/AuthKey_UBW264Z9Z8.p8')
if File.exist?(p8_path2)
  p8_content2 = File.binread(p8_path2)
  key2 = OpenSSL::PKey::EC.new(p8_content2)
  
  header2 = { kid: "UBW264Z9Z8", typ: 'JWT' }
  payload2 = {
    iat: now.to_i - 60,
    exp: (now + 500).to_i,
    aud: 'appstoreconnect-v1',
    iss: issuer_id
  }
  token2 = JWT.encode(payload2, key2, 'ES256', header2)
  
  uri2 = URI('https://api.appstoreconnect.apple.com/v1/apps')
  http2 = Net::HTTP.new(uri2.host, uri2.port)
  http2.use_ssl = true
  http2.open_timeout = 10
  http2.read_timeout = 30
  
  request2 = Net::HTTP::Get.new(uri2)
  request2['Authorization'] = "Bearer #{token2}"
  request2['Content-Type'] = 'application/json'
  
  begin
    response2 = http2.request(request2)
    puts "Status: #{response2.code}"
    puts "Body (first 300 chars): #{response2.body[0..300]}"
  rescue => e
    puts "Error: #{e.class}: #{e.message}"
  end
end
