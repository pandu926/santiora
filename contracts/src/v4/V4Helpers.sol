// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title V4Helpers - JSON parsing and string utilities (library)
/// @notice Gas-efficient on-chain JSON extraction for agent response parsing
library V4Helpers {

    uint256 private constant NOT_FOUND = type(uint256).max;

    /// @notice Extract string value for a given key from JSON
    /// @dev Handles whitespace after colon, escaped quotes in value
    function jsonString(string memory json, string memory key) internal pure returns (string memory) {
        bytes memory data = bytes(json);
        bytes memory needle = bytes(string.concat('"', key, '":'));
        uint256 start = find(data, needle);
        if (start == NOT_FOUND) return "";
        start += needle.length;
        start = skipWhitespace(data, start);
        if (start >= data.length || data[start] != '"') return "";
        start++;
        uint256 end = start;
        while (end < data.length && data[end] != '"') {
            if (data[end] == '\\' && end + 1 < data.length) end++;
            end++;
        }
        return slice(data, start, end);
    }

    /// @notice Extract uint value for a given key from JSON
    function jsonUint(string memory json, string memory key) internal pure returns (uint256) {
        bytes memory data = bytes(json);
        bytes memory needle = bytes(string.concat('"', key, '":'));
        uint256 start = find(data, needle);
        if (start == NOT_FOUND) return 0;
        start += needle.length;
        while (start < data.length && (data[start] < '0' || data[start] > '9')) start++;
        uint256 value;
        while (start < data.length && data[start] >= '0' && data[start] <= '9') {
            value = value * 10 + uint8(data[start]) - 48;
            start++;
        }
        return value;
    }

    /// @notice Extract bool value for a given key from JSON
    function jsonBool(string memory json, string memory key) internal pure returns (bool) {
        bytes memory data = bytes(json);
        bytes memory needle = bytes(string.concat('"', key, '":'));
        uint256 start = find(data, needle);
        if (start == NOT_FOUND) return false;
        start += needle.length;
        start = skipWhitespace(data, start);
        return (start + 4 <= data.length &&
                data[start] == 't' && data[start+1] == 'r' &&
                data[start+2] == 'u' && data[start+3] == 'e');
    }

    /// @notice Decode inferToolsChat response - extract the response string
    function decodeChatResponse(bytes memory result) internal pure returns (string memory response) {
        (, response,,,,) = abi.decode(result, (string, string, string[], string[], string[], bytes[]));
    }

    /// @notice Clamp value between min and max
    function bound(uint256 value, uint256 min, uint256 max) internal pure returns (uint256) {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    /// @notice Check if outcome string represents YES
    function isYes(string memory value) internal pure returns (bool) {
        return equals(value, "YES") || equals(value, "yes") || equals(value, "Yes");
    }

    /// @notice String equality check
    function equals(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    /// @notice Truncate string to maxLen bytes
    function truncate(string memory s, uint256 maxLen) internal pure returns (string memory) {
        bytes memory data = bytes(s);
        if (data.length <= maxLen) return s;
        return slice(data, 0, maxLen);
    }

    /// @notice Uint to string
    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) { digits--; buffer[digits] = bytes1(uint8(48 + value % 10)); value /= 10; }
        return string(buffer);
    }

    // --- Internal helpers -----------------------------------------------------

    function find(bytes memory haystack, bytes memory needle) internal pure returns (uint256) {
        if (needle.length == 0 || needle.length > haystack.length) return NOT_FOUND;
        uint256 limit = haystack.length - needle.length;
        for (uint256 i = 0; i <= limit; i++) {
            bool matched = true;
            for (uint256 j = 0; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) { matched = false; break; }
            }
            if (matched) return i;
        }
        return NOT_FOUND;
    }

    function skipWhitespace(bytes memory data, uint256 pos) internal pure returns (uint256) {
        while (pos < data.length && (data[pos] == ' ' || data[pos] == '\t' || data[pos] == '\n' || data[pos] == '\r')) pos++;
        return pos;
    }

    function slice(bytes memory data, uint256 start, uint256 end) internal pure returns (string memory) {
        bytes memory out = new bytes(end - start);
        for (uint256 i = 0; i < out.length; i++) out[i] = data[start + i];
        return string(out);
    }
}
