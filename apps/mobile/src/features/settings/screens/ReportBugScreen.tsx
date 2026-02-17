import type { SettingsStackParamList } from '@/navigation/types';
import { useAlert } from '@/shared/lib/AlertContext';
import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import React from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { CustomBackIconSvg } from '@assets/icons/svgStrings';
import { svgToDataUri } from '@/shared/utils/svgUtils';
import { Image } from 'expo-image';

type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'ReportBug'>;

const CREATE_TICKET_MUTATION = `
  mutation CreateTicket($input: CreateTicketInput!) {
    createTicket(input: $input) {
      id
      subject
      status
    }
  }
`;

export default function ReportBugScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { showAlert } = useAlert();

  const createTicket = useMutation({
    mutationFn: async (data: { subject: string; description: string }) => {
      const deviceInfo = {
        platform: Platform.OS,
        osVersion: Platform.Version,
        deviceModel: Device.modelName,
        appVersion: Constants.expoConfig?.version || 'unknown',
      };

      const result = await graphqlFetch<{
        createTicket: { id: string; subject: string; status: string };
      }>({
        query: CREATE_TICKET_MUTATION,
        variables: {
          input: {
            subject: data.subject,
            description: data.description,
            type: 'BUG_REPORT',
            deviceInfo: JSON.stringify(deviceInfo),
          },
        },
      });
      return result.createTicket;
    },
    onSuccess: () => {
      showAlert('Bug report submitted successfully. We will look into it.', { type: 'success' });
      navigation.goBack();
    },
    onError: (error: Error) => {
      showAlert(error.message || 'Failed to submit bug report', { type: 'error' });
    },
  });

  const form = useForm({
    defaultValues: {
      subject: '',
      description: '',
    },
    onSubmit: async ({ value }) => {
      if (!value.subject.trim()) {
        showAlert('Please enter a subject', { type: 'warning' });
        return;
      }
      if (!value.description.trim()) {
        showAlert('Please describe the bug', { type: 'warning' });
        return;
      }
      createTicket.mutate(value);
    },
  });

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
          <Text className="flex-1 text-center text-xl font-semibold">Report a Bug</Text>
        </View>

        <ScrollView className="flex-1 px-4">
          <Text className="text-sm text-gray-600 mb-6">
            Found something that isn't working correctly? Let us know and we'll fix it as soon as possible.
          </Text>

          <form.Field name="subject">
            {(field) => (
              <View className="mb-4">
                <Text className="text-xs font-semibold mb-2">Subject</Text>
                <TextInput
                  className="bg-white rounded-lg px-4 py-3 text-sm border border-gray-200"
                  placeholder="Brief description of the issue"
                  placeholderTextColor="#9CA3AF"
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  maxLength={100}
                />
              </View>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <View className="mb-6">
                <Text className="text-xs font-semibold mb-2">Description</Text>
                <TextInput
                  className="bg-white rounded-lg px-4 py-3 text-sm border border-gray-200 min-h-[150px]"
                  placeholder="Please describe the bug in detail. Include steps to reproduce if possible."
                  placeholderTextColor="#9CA3AF"
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  multiline
                  textAlignVertical="top"
                  maxLength={2000}
                />
                <Text className="text-[10px] text-gray-400 mt-1 text-right">
                  {field.state.value.length}/2000
                </Text>
              </View>
            )}
          </form.Field>

          <TouchableOpacity
            className="bg-[#E4CAC7] py-4 rounded-full mb-8"
            onPress={() => form.handleSubmit()}
            disabled={createTicket.isPending}
          >
            {createTicket.isPending ? (
              <ActivityIndicator color="#1F2937" />
            ) : (
              <Text className="text-center text-gray-800 font-semibold text-base">
                Submit Bug Report
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}
