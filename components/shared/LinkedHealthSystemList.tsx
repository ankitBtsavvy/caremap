// components/LinkedAllergyList.tsx
import React from "react";
import { View, Text, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import palette from "@/utils/theme/color";
import { Calendar } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
interface LinkedAllergyListProps<T> {
  data: T[];
  titleKey?: keyof T; // e.g. "topic" | "goal_description" | "name"
  detailsKey?: keyof T; // e.g. "details" | "target_date" | "description"
  dateKey?: keyof T; // e.g. "created_at" | "updated_at" | "date"
}

// Default MM/DD/YY formatter
const formatDateMMDDYY = (dateString: string): string => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `${mm}-${dd}-${yy}`;
};

export function LinkedAllergyList<
  T extends { id: number | string; topic?: string; details?: string }
>({ data, titleKey, detailsKey, dateKey }: LinkedAllergyListProps<T>) {
  return (
    <View>
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id)}
        scrollEnabled={true}
        showsVerticalScrollIndicator={true}
        renderItem={({ item }) => {
          const title = titleKey ? String(item[titleKey]) : "";
          const details =
            detailsKey && item[detailsKey]
              ? String(item[detailsKey])
              : undefined;
          const date =
            dateKey && item[dateKey]
              ? formatDateMMDDYY(String(item[dateKey]))
              : undefined;

          return (
            <View className="border border-gray-300 rounded-lg mb-3 px-3 py-3">
              {/* Row: title + right icons */}
              <View className="flex-row items-center justify-between">
                {/* Left Section: title */}
                <View className="flex-row items-center space-x-2">
                  <Text className="text-lg ml-3 max-w-[220px] text-left font-semibold text-gray-900">
                    {title}
                  </Text>
                </View>

                {/* Right Section: date + lock icon */}
                <View className="flex-row items-center">
                  {date ? (
                    <View className="flex-row items-center">
                      <Icon
                        as={Calendar}
                        size="sm"
                        className="text-gray-600 mr-1"
                      />
                      <Text className="text-lg text-gray-700 mr-3">{date}</Text>
                    </View>
                  ) : null}

                  <Ionicons
                    name="lock-closed"
                    size={18}
                    color={palette.primary}
                  />
                </View>
              </View>

              {/* Details below */}
              {details ? (
                <View className="px-3 mt-1">
                  <Text className="text-md text-gray-700">{details}</Text>
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <Text className="text-gray-500">No linked records found.</Text>
        }
        style={{ minHeight: 50 }}
      />
    </View>
  );
}

export default LinkedAllergyList;
