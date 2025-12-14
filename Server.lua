local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")

local PARTS_URL = "http://localhost:3000/parts"
local KICK_URL = "http://localhost:3000/kickqueue"
local UPDATE_INTERVAL = 0.15

local function getPartId(part)
	return part:GetFullName():gsub("%.", "_")
end

local function getPartType(part)
	if part:IsA("MeshPart") then
		return "Block"
	elseif part:IsA("WedgePart") then
		if part.ClassName == "CornerWedgePart" then
			return "CornerWedge"
		else
			return "Wedge"
		end
	else
		local shape = part.Shape
		if shape == Enum.PartType.Ball then
			return "Ball"
		elseif shape == Enum.PartType.Cylinder then
			return "Cylinder"
		else
			return "Block"
		end
	end
end

spawn(function()
	while true do
		wait(UPDATE_INTERVAL)

		local bulkParts = {}

		for _, part in ipairs(Workspace:GetDescendants()) do
			if part:IsA("BasePart") and part.Name ~= "Terrain" then
				local cframe = part.CFrame
				local rx, ry, rz = cframe:ToEulerAnglesXYZ()
				local id = getPartId(part)
				local pType = getPartType(part)

				table.insert(bulkParts, {
					id = id,
					type = pType,
					pos = {part.Position.X/3, part.Position.Y/3, part.Position.Z/3},
					size = {part.Size.X/3, part.Size.Y/3, part.Size.Z/3},
					rotation = {math.deg(rx), math.deg(ry), math.deg(rz)},
					color = math.floor(part.Color.R*255)*65536
						+ math.floor(part.Color.G*255)*256
						+ math.floor(part.Color.B*255),
					transparency = part.Transparency,
					isPlayer = false
				})
			end
		end

		for _, player in ipairs(Players:GetPlayers()) do
			if player.Character and player.Character:FindFirstChild("HumanoidRootPart") then
				local root = player.Character.HumanoidRootPart
				local head = player.Character:FindFirstChild("Head")
				local heightOffset = 2
				if head then
					heightOffset = head.Position.Y/3 - root.Position.Y/3 + 1
				end

				table.insert(bulkParts, {
					id = player.Name .. "_" .. player.UserId,
					pos = {root.Position.X/3, root.Position.Y/3 + heightOffset, root.Position.Z/3},
					size = {0, 0, 0},
					color = 0x00ff00,
					transparency = 1,
					isPlayer = true
				})
			end
		end

		pcall(function()
			HttpService:PostAsync(
				PARTS_URL,
				HttpService:JSONEncode(bulkParts),
				Enum.HttpContentType.ApplicationJson
			)
		end)

		pcall(function()
			local response = HttpService:GetAsync(KICK_URL)
			local kickQueue = HttpService:JSONDecode(response)
			for _, id in ipairs(kickQueue) do
				local userIdStr = id:match("_(%d+)$")
				if userIdStr then
					local userId = tonumber(userIdStr)
					local player = Players:GetPlayerByUserId(userId)
					if player then
						player:Kick("You were kicked via viewer.")
					end
				end
			end
		end)
	end
end)
