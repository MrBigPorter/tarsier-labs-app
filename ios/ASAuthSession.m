#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ASAuthSession, NSObject)

RCT_EXTERN_METHOD(startAuth:(NSString *)url
                  callbackUrlScheme:(NSString *)callbackUrlScheme
                  prefersEphemeralSession:(BOOL)prefersEphemeralSession
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
