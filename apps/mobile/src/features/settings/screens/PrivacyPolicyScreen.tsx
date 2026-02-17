import type { SettingsStackParamList } from '@/navigation/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { CustomBackIconSvg } from '@assets/icons/svgStrings';
import { svgToDataUri } from '@/shared/utils/svgUtils';
import { Image } from 'expo-image';

type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'PrivacyPolicy'>;

export default function PrivacyPolicyScreen() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <View className="flex-1 bg-[#DCDCDE]">
      <StatusBar barStyle="dark-content" />

      <View className="w-full pt-14 px-4 pb-4 flex-row items-center">
        <TouchableOpacity
          className="absolute left-4 top-14 w-10 h-10 bg-[#DFD2CD] rounded-full flex justify-center items-center"
          onPress={() => navigation.goBack()}
        >
          <Image
            source={{ uri: svgToDataUri(CustomBackIconSvg) }}
            style={{ width: 30, height: 30 }}
          />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-xl font-semibold">Privacy Policy</Text>
      </View>

      <ScrollView className="flex-1 px-4">
        <View className="bg-white rounded-lg p-4 mb-4">
          <Text className="text-lg font-bold mb-4">Capture Privacy Policy</Text>
          <Text className="text-xs text-gray-500 mb-4">Last updated: December 2025</Text>

          <Text className="text-sm font-semibold mb-2">1. Information We Collect</Text>
          <Text className="text-sm text-gray-700 mb-4">
            We collect information you provide directly to us, such as when you create an account,
            upload content, or communicate with us. This includes your email address, profile
            information, photos, and any other content you choose to share.
          </Text>

          <Text className="text-sm font-semibold mb-2">2. How We Use Your Information</Text>
          <Text className="text-sm text-gray-700 mb-4">
            We use the information we collect to provide, maintain, and improve our services,
            to communicate with you, and to personalize your experience. We do not sell your
            personal information to third parties.
          </Text>

          <Text className="text-sm font-semibold mb-2">3. Data Storage and Security</Text>
          <Text className="text-sm text-gray-700 mb-4">
            Your data is stored securely using industry-standard encryption and security measures.
            We retain your information only as long as necessary to provide our services or as
            required by law.
          </Text>

          <Text className="text-sm font-semibold mb-2">4. Your Rights</Text>
          <Text className="text-sm text-gray-700 mb-4">
            You have the right to access, correct, or delete your personal information at any time.
            You can delete your account from the Account Settings page, which will anonymize your
            posts and comments.
          </Text>

          <Text className="text-sm font-semibold mb-2">5. Third-Party Services</Text>
          <Text className="text-sm text-gray-700 mb-4">
            We may use third-party services for analytics, authentication, and other purposes.
            These services have their own privacy policies governing the use of your information.
          </Text>

          <Text className="text-sm font-semibold mb-2">6. Changes to This Policy</Text>
          <Text className="text-sm text-gray-700 mb-4">
            We may update this privacy policy from time to time. We will notify you of any changes
            by posting the new policy on this page and updating the "Last updated" date.
          </Text>

          <Text className="text-sm font-semibold mb-2">7. Contact Us</Text>
          <Text className="text-sm text-gray-700 mb-8">
            If you have any questions about this privacy policy, please contact us through the
            app's feedback feature or email us at privacy@captureapp.org.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
